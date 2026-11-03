const crypto=require('node:crypto'),https=require('node:https'),db=require('../db');
const {getSettings}=require('./commerce-settings');
const origin='https://mikyajkw.com';
const webPush=require('web-push');
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
function pushReady(){return !!(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY&&process.env.VAPID_SUBJECT)}
// Endpoint host allowlist and disabled redirects prevent a subscription becoming an SSRF primitive.
function subscription(value){
 let endpoint;try{endpoint=new URL(value?.endpoint)}catch{throw Object.assign(Error('Invalid push subscription.'),{status:400})}
 const allowed=['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'];
 if(endpoint.protocol!=='https:'||endpoint.port||endpoint.username||endpoint.password||endpoint.hash||!allowed.includes(endpoint.hostname)||endpoint.href.length>2048||!/^[A-Za-z0-9_-]{87}$/.test(value?.keys?.p256dh||'')||!/^[A-Za-z0-9_-]{22}$/.test(value?.keys?.auth||''))throw Object.assign(Error('Unsupported push subscription.'),{status:400});
 return {endpoint:endpoint.href,keys:{p256dh:value.keys.p256dh,auth:value.keys.auth}};
}
async function enqueue(orderId,kind,connection=db){
 const event=(await connection.query('INSERT INTO order_alert_events(order_id,kind) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id',[orderId,kind])).rows[0];if(!event)return;
 await connection.query(`INSERT INTO order_alert_deliveries(event_id,subscription_id)
 SELECT $1,s.id FROM admin_push_subscriptions s JOIN admin_users u ON u.id=s.admin_id
 WHERE u.status='ACTIVE' AND (u.role IN ('ADMIN','SUPER_ADMIN') OR (u.role='STAFF' AND u.permissions ? 'orders')) ON CONFLICT DO NOTHING`,[event.id]);
 const settings=await getSettings('notifications',connection);
 if(settings.email_enabled===true&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.admin_email||''))await connection.query('INSERT INTO order_alert_deliveries(event_id,email) VALUES($1,$2) ON CONFLICT DO NOTHING',[event.id,settings.admin_email]);
}
function payload(event){return {title:event.kind==='CONFIRMED'?'Mikyaj · order confirmed':'Mikyaj · new order',body:`Order #${event.order_number} · ${Number(event.total_amount).toFixed(3)} KWD · ${event.status.replaceAll('_',' ')}`,tag:'mikyaj-order-'+event.order_id+'-'+event.kind,url:'/admin/manage.html?view=orders&order='+encodeURIComponent(event.order_number)}}
async function sendPush(saved,data){
 if(!pushReady())throw Object.assign(Error('Push not configured'),{safeCode:'PUSH_NOT_CONFIGURED'});
 return webPush.sendNotification(subscription(saved),JSON.stringify(data),{TTL:3600,urgency:'high',timeout:10000,vapidDetails:{subject:process.env.VAPID_SUBJECT,publicKey:process.env.VAPID_PUBLIC_KEY,privateKey:process.env.VAPID_PRIVATE_KEY},agent:new https.Agent({keepAlive:false})});
}
async function sendEmail(email,event){
 if(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM)throw Object.assign(Error('Email not configured'),{safeCode:'EMAIL_NOT_CONFIGURED'});
 const p=payload(event),r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'mikyaj-order-alert-'+event.event_id},body:JSON.stringify({from:process.env.EMAIL_FROM,to:email,subject:p.title+' #'+event.order_number,text:p.body+'\nOpen securely: '+origin+p.url+'\nSign in to view customer and product details.'}),signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Object.assign(Error('Email delivery failed'),{safeCode:'EMAIL_HTTP_'+r.status});
}
let busy=false;
async function dispatch({sendPushFn=sendPush,sendEmailFn=sendEmail}={}){
 if(busy)return;busy=true;
 try{await db.query("UPDATE order_alert_deliveries SET status='FAILED',last_error='RETRY_LIMIT' WHERE status='PENDING' AND attempts>=8 AND next_attempt_at<=NOW()");for(let i=0;i<10;i++){
  // Lease one job atomically; interrupted work becomes retryable after two minutes.
  const job=(await db.query(`UPDATE order_alert_deliveries SET attempts=attempts+1,next_attempt_at=NOW()+INTERVAL '2 minutes'
   WHERE id=(SELECT id FROM order_alert_deliveries WHERE status='PENDING' AND next_attempt_at<=NOW() AND attempts<8 ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`)).rows[0];if(!job)break;
  const event=(await db.query('SELECT e.id AS event_id,e.order_id,e.kind,e.created_at,o.order_number,o.total_amount,o.status FROM order_alert_events e JOIN orders o ON o.id=e.order_id WHERE e.id=$1',[job.event_id])).rows[0];
  if(!event||Date.now()-new Date(event.created_at)>24*3600000){await db.query("UPDATE order_alert_deliveries SET status='SKIPPED',last_error='EXPIRED' WHERE id=$1",[job.id]);continue}
  try{
   if(job.subscription_id){const s=(await db.query(`SELECT s.subscription FROM admin_push_subscriptions s JOIN admin_users u ON u.id=s.admin_id WHERE s.id=$1 AND u.status='ACTIVE' AND (u.role IN ('ADMIN','SUPER_ADMIN') OR (u.role='STAFF' AND u.permissions ? 'orders'))`,[job.subscription_id])).rows[0];if(!s){await db.query("UPDATE order_alert_deliveries SET status='SKIPPED',last_error='ACCESS_REVOKED' WHERE id=$1",[job.id]);continue}await sendPushFn(s.subscription,payload(event));}
   else {const settings=await getSettings('notifications');if(settings.email_enabled!==true||settings.admin_email!==job.email){await db.query("UPDATE order_alert_deliveries SET status='SKIPPED',last_error='EMAIL_DISABLED' WHERE id=$1",[job.id]);continue}await sendEmailFn(job.email,event);}
   await db.query("UPDATE order_alert_deliveries SET status='SENT',sent_at=NOW(),last_error=NULL WHERE id=$1",[job.id]);
  }catch(e){
   if(job.subscription_id&&[404,410].includes(e.statusCode)){await db.query('DELETE FROM admin_push_subscriptions WHERE id=$1',[job.subscription_id]);continue}
   const code=e.safeCode||([400,401,403,413,429].includes(e.statusCode)?'PUSH_HTTP_'+e.statusCode:'DELIVERY_FAILED');
   await db.query("UPDATE order_alert_deliveries SET status=$2,next_attempt_at=NOW()+($3*INTERVAL '1 minute'),last_error=$4 WHERE id=$1",[job.id,job.attempts>=8?'FAILED':'PENDING',Math.min(60,2**job.attempts),code]);
  }
 }}finally{busy=false}
}
function start(){const run=()=>dispatch().catch(e=>console.error('Order alert worker unavailable:',e.code||e.name));run();const timer=setInterval(run,15000);timer.unref();return()=>clearInterval(timer)}
module.exports={enqueue,dispatch,start,pushReady,subscription,sendPush,payload,hash};
