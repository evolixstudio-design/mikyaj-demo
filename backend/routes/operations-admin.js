const router=require('express').Router(),db=require('../db'),bcrypt=require('bcryptjs');
const {fail}=require('../services/commerce-quote');
const {audit,getSettings}=require('../services/commerce-settings');
const {PERMISSIONS}=require('../middleware/admin-auth');
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
const id=v=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<1)fail('Invalid ID');return n};
router.get('/translate',wrap(async(req,res)=>res.json({configured:Boolean(process.env.TRANSLATION_URL||await require('../services/commerce-settings').getSecret('GOOGLE_TRANSLATE_API_KEY'))})));
router.post('/translate',require('../middleware/rate-limit')(30,60000),wrap(async(req,res)=>res.json({text:await require('../services/translation').translate(req.body.text,req.body.source,req.body.target)})));
router.get('/search',wrap(async(req,res)=>{
 const q='%'+String(req.query.q||'').trim().slice(0,100)+'%';if(q.length<4)return res.json([]);
 const permissions=req.admin.role==='STAFF'?req.admin.permissions:PERMISSIONS,groups=[];
 const add=async(type,permission,sql,link,label)=>{if(!permissions.includes(permission))return;const rows=(await db.query(sql,[q])).rows;groups.push({type,items:rows.map(r=>({label:label(r),url:link(r)}))})};
 await add('Products','products',"SELECT id,name_ar,name_en FROM products WHERE deleted_at IS NULL AND (name_ar ILIKE $1 OR name_en ILIKE $1 OR sku ILIKE $1) ORDER BY id DESC LIMIT 6",r=>'/admin/manage.html?view=product&id='+r.id,r=>r.name_en||r.name_ar);
 await add('Orders','orders','SELECT order_number,customer_name FROM orders WHERE order_number ILIKE $1 OR customer_name ILIKE $1 ORDER BY id DESC LIMIT 6',r=>'/admin/manage.html?view=orders&order='+encodeURIComponent(r.order_number),r=>r.order_number+' · '+r.customer_name);
 await add('Customers','customers','SELECT id,name,email FROM customers WHERE name ILIKE $1 OR email ILIKE $1 ORDER BY id DESC LIMIT 6',r=>'/admin/manage.html?view=customers&id='+r.id,r=>r.name+' · '+r.email);
 await add('Discounts','discounts','SELECT id,title,code FROM discounts WHERE title ILIKE $1 OR title_ar ILIKE $1 OR code ILIKE $1 ORDER BY id DESC LIMIT 6',r=>'/admin/manage.html?view=offers&id='+r.id,r=>r.title+(r.code?' · '+r.code:''));
 for(const kind of ['categories','brands'])await add(kind,'products',`SELECT id,${kind==='brands'?'name':'name_en AS name'} FROM ${kind} WHERE ${kind==='brands'?'name':'name_en'} ILIKE $1 OR name_ar ILIKE $1 LIMIT 6`,()=>'/admin/manage.html?view='+kind,r=>r.name);
 if(permissions.includes('settings'))groups.push({type:'Settings',items:['General','Payments','Shipping','Users','Integrations'].filter(s=>s.toLowerCase().includes(q.slice(1,-1).toLowerCase())).map(label=>({label,url:label==='Users'?'/admin/manage.html?view=users':'/admin/manage.html?view=settings&section='+label.toLowerCase()}))});
 res.json(groups);
}));
router.get('/users',wrap(async(req,res)=>res.json({permissions:PERMISSIONS,users:(await db.query('SELECT id,name,email,role,status,permissions,created_at FROM admin_users ORDER BY id')).rows})));
async function saveUser(req,res){
 const b=req.body,role=b.role,status=b.status||'ACTIVE';if(!['SUPER_ADMIN','ADMIN','STAFF'].includes(role)||!['ACTIVE','INACTIVE'].includes(status))fail('Invalid user role or status');
 const email=String(b.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('Invalid email');
 const permissions=Array.isArray(b.permissions)?b.permissions.filter(p=>PERMISSIONS.includes(p)):[];let hash;
 if(b.password){if(typeof b.password!=='string'||b.password.length<12||Buffer.byteLength(b.password)>72)fail('Use a password of 12–72 characters');hash=await bcrypt.hash(b.password,12)}
 if(!req.params.id&&!hash)fail('A password is required for a new staff account');
 const client=await db.pool.connect();try{await client.query('BEGIN');await client.query("SELECT id FROM admin_users WHERE role='SUPER_ADMIN' ORDER BY id FOR UPDATE");let user;
 if(req.params.id){const userId=id(req.params.id);if(userId===req.admin.id&&(role!=='SUPER_ADMIN'||status!=='ACTIVE'))fail('You cannot remove your own owner access.');const current=(await client.query('SELECT * FROM admin_users WHERE id=$1 FOR UPDATE',[userId])).rows[0];if(!current)fail('User not found',404);if(current.role==='SUPER_ADMIN'&&(role!=='SUPER_ADMIN'||status!=='ACTIVE')){const owners=(await client.query("SELECT id FROM admin_users WHERE role='SUPER_ADMIN' AND status='ACTIVE'")).rows;if(owners.length<=1)fail('Keep at least one active store owner.');}user=(await client.query('UPDATE admin_users SET email=$1,name=$2,role=$3,status=$4,permissions=$5,password_hash=COALESCE($6,password_hash),session_version=session_version+1,updated_at=NOW() WHERE id=$7 RETURNING id',[email,String(b.name||'').slice(0,150),role,status,JSON.stringify(permissions),hash||null,userId])).rows[0]}
 else user=(await client.query('INSERT INTO admin_users(email,name,password_hash,role,status,permissions) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[email,String(b.name||'').slice(0,150),hash,role,status,JSON.stringify(permissions)])).rows[0];
 await audit(req.admin.id,'user.save',user.id,{role,status},client);await client.query('COMMIT');res.json(user);
 }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
}
router.post('/users',wrap(saveUser));router.put('/users/:id',wrap(saveUser));
router.get('/customers/list',wrap(async(req,res)=>{
 const page=Number(req.query.page||1),limit=40;
 if(!Number.isSafeInteger(page)||page<1||page>100000)fail('Invalid page');
 const search='%'+String(req.query.search||'').trim().slice(0,100)+'%',status=String(req.query.status||'');
 if(status&&!['ACTIVE','INACTIVE'].includes(status))fail('Invalid customer status');
 const where="(c.email ILIKE $1 OR c.name ILIKE $1 OR c.phone ILIKE $1) AND ($2='' OR c.status=$2)";
 const total=Number((await db.query('SELECT COUNT(*) AS total FROM customers c WHERE '+where,[search,status])).rows[0].total);
 const rows=(await db.query(`SELECT c.id,c.name,c.email,c.phone,c.status,c.created_at,COUNT(o.id)::int AS order_count,COALESCE(SUM(o.total_amount) FILTER(WHERE o.status IN ('CONFIRMED','PROCESSING','READY_FOR_DELIVERY','OUT_FOR_DELIVERY','DELIVERED')),0) AS total_spend FROM customers c LEFT JOIN orders o ON o.customer_id=c.id WHERE ${where} GROUP BY c.id ORDER BY c.id DESC LIMIT $3 OFFSET $4`,[search,status,limit,(page-1)*limit])).rows;
 res.json({customers:rows,total,page,limit});
}));
router.get('/customers/:id',wrap(async(req,res)=>{const customer=(await db.query('SELECT id,name,email,phone,status,created_at FROM customers WHERE id=$1',[id(req.params.id)])).rows[0];if(!customer)fail('Customer not found',404);const orders=(await db.query('SELECT order_number,total_amount,status,payment_method,created_at FROM orders WHERE customer_id=$1 ORDER BY id DESC LIMIT 100',[customer.id])).rows;const addresses=(await db.query('SELECT * FROM customer_addresses WHERE customer_id=$1 ORDER BY is_default DESC,id DESC',[customer.id])).rows;const returns=(await db.query('SELECT r.*,o.order_number FROM return_requests r JOIN orders o ON o.id=r.order_id WHERE o.customer_id=$1 ORDER BY r.id DESC',[customer.id])).rows;res.json({customer,orders,addresses,returns})}));
router.patch('/customers/:id',wrap(async(req,res)=>{if(!['ACTIVE','INACTIVE'].includes(req.body.status))fail('Invalid status');const result=await db.query('UPDATE customers SET status=$1,session_version=session_version+1,updated_at=NOW() WHERE id=$2 RETURNING id',[req.body.status,id(req.params.id)]);if(!result.rows.length)fail('Customer not found',404);await audit(req.admin.id,'customer.status',req.params.id,{status:req.body.status});res.json({success:true})}));
router.get('/notifications',wrap(async(req,res)=>{const permissions=req.admin.role==='STAFF'?req.admin.permissions:PERMISSIONS;const notifications=[];
 if(permissions.includes('orders'))for(const o of (await db.query("SELECT id,order_number,created_at FROM orders WHERE status='CONFIRMED' ORDER BY id DESC LIMIT 30")).rows)notifications.push({key:'order:'+o.id,title:'New order '+o.order_number,url:'/admin/manage.html?view=orders&order='+o.order_number,date:o.created_at});
 if(permissions.includes('returns'))for(const r of (await db.query("SELECT id,created_at FROM return_requests WHERE status='REQUESTED' ORDER BY id DESC LIMIT 30")).rows)notifications.push({key:'return:'+r.id,title:'Return request #'+r.id,url:'/admin/manage.html?view=returns',date:r.created_at});
 if(permissions.includes('products'))for(const p of (await db.query("SELECT id,name_ar,name_en,updated_at FROM products WHERE deleted_at IS NULL AND inventory_quantity<=low_stock_threshold ORDER BY updated_at DESC LIMIT 30")).rows)notifications.push({key:'stock:'+p.id+':'+new Date(p.updated_at).toISOString(),title:'Low stock: '+(p.name_en||p.name_ar),url:'/admin/manage.html?view=product&id='+p.id,date:p.updated_at});
 const read=(await db.query('SELECT key FROM admin_notification_reads WHERE admin_id=$1',[req.admin.id])).rows.map(r=>r.key);res.json(notifications.sort((a,b)=>new Date(b.date)-new Date(a.date)).map(n=>({...n,read:read.includes(n.key)})));
}));
router.post('/notifications/read',wrap(async(req,res)=>{const keys=req.body.keys;if(!Array.isArray(keys)||keys.length>100||keys.some(k=>typeof k!=='string'||k.length>150))fail('Invalid notifications');for(const key of keys)await db.query('INSERT INTO admin_notification_reads(admin_id,key) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.admin.id,key]);res.json({success:true})}));
router.get('/analytics',wrap(async(req,res)=>{
 const now=new Date(),end=req.query.end?new Date(req.query.end):now,start=req.query.start?new Date(req.query.start):new Date(now-30*86400000);if(!Number.isFinite(+start)||!Number.isFinite(+end)||start>=end||end-start>367*86400000)fail('Choose a date range of up to one year');const values=[start,end];
 const sales=(await db.query("SELECT COUNT(*)::int orders,COALESCE(SUM(total_amount),0) sales,COALESCE(AVG(total_amount),0) average_order_value FROM orders WHERE created_at>=$1 AND created_at<$2 AND status IN ('CONFIRMED','PROCESSING','READY_FOR_DELIVERY','OUT_FOR_DELIVERY','DELIVERED')",values)).rows[0];
 const traffic=(await db.query("SELECT COUNT(*) FILTER(WHERE event='page_view')::int page_views,COUNT(DISTINCT session_id)::int sessions,COUNT(DISTINCT customer_id)::int signed_in_customers,COUNT(*) FILTER(WHERE event='add_to_cart')::int add_to_cart,COUNT(*) FILTER(WHERE event='checkout_started')::int checkouts FROM commerce_events WHERE created_at>=$1 AND created_at<$2",values)).rows[0];
 const daily=(await db.query("SELECT date_trunc('day',created_at AT TIME ZONE 'Asia/Kuwait')::date AS day,COUNT(*)::int orders,SUM(total_amount) sales FROM orders WHERE created_at>=$1 AND created_at<$2 AND status IN ('CONFIRMED','PROCESSING','READY_FOR_DELIVERY','OUT_FOR_DELIVERY','DELIVERED') GROUP BY 1 ORDER BY 1",values)).rows;
 const top=(await db.query("SELECT p.id,p.name_ar,p.name_en,SUM(oi.quantity)::int units,SUM(oi.quantity*oi.price_at_purchase) revenue FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN products p ON p.id=oi.product_id WHERE o.created_at>=$1 AND o.created_at<$2 AND o.status IN ('CONFIRMED','PROCESSING','READY_FOR_DELIVERY','OUT_FOR_DELIVERY','DELIVERED') GROUP BY p.id ORDER BY units DESC LIMIT 10",values)).rows;
 const devices=(await db.query('SELECT device,COUNT(DISTINCT session_id)::int sessions FROM commerce_events WHERE created_at>=$1 AND created_at<$2 GROUP BY device',values)).rows;
 const customers=(await db.query('SELECT COUNT(*)::int count FROM customers WHERE created_at>=$1 AND created_at<$2',values)).rows[0].count;
 res.json({start,end,sales,traffic,daily,top,devices,new_customers:customers,tracking_enabled:(await getSettings('events')).enabled===true,note:'Order value includes confirmed cash-on-delivery orders; it is not settled revenue. Traffic begins when tracking is enabled. Anonymous sessions are not identifiable people.'});
}));
module.exports=router;
