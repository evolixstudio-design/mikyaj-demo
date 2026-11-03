const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),request=require('supertest'),crypto=require('node:crypto'),jwt=require('jsonwebtoken');
let fixture,app,admin,created,sub;
const address={governorate:'Capital',area:'Kuwait City',block:'1',street:'Test',building:'10'};
const checkout=()=>({idempotencyKey:crypto.randomUUID(),items:[{productId:1,qty:1}],payment_method:'COD',customer:{name:'Private buyer',phone:'66232231',address}});
before(async()=>{fixture=await require('./isolated-db.cjs').setup();app=require('../backend/app').createApp();admin={Authorization:'Bearer '+jwt.sign({id:1,role:'SUPER_ADMIN'},process.env.ADMIN_JWT_SECRET)};const keys=require('web-push').generateVAPIDKeys();process.env.VAPID_PUBLIC_KEY=keys.publicKey;process.env.VAPID_PRIVATE_KEY=keys.privateKey;process.env.VAPID_SUBJECT='https://mikyajkw.com';sub={endpoint:'https://fcm.googleapis.com/fcm/send/test-only-endpoint',keys:{p256dh:Buffer.concat([Buffer.from([4]),crypto.randomBytes(64)]).toString('base64url'),auth:crypto.randomBytes(16).toString('base64url')}}});
after(async()=>fixture?.close());
test('notification endpoints enforce permissions and reject internal/arbitrary push endpoints',async()=>{
 assert.equal((await request(app).get('/api/manage/orders/alerts')).status,401);
 for(const endpoint of ['http://127.0.0.1/','https://169.254.169.254/','https://example.test/','https://fcm.googleapis.com.evil.test/','https://fcm.googleapis.com:444/x'])assert.equal((await request(app).post('/api/manage/orders/alerts/subscriptions').set(admin).send({...sub,endpoint})).status,400);
 assert.equal((await request(app).post('/api/manage/orders/alerts/subscriptions').set(admin).send(sub)).status,200);
 const feed=await request(app).get('/api/manage/orders/alerts').set(admin);assert.equal(feed.status,200);assert.deepEqual(feed.body.events,[]);
});
test('one committed checkout queues one durable alert, replay does not duplicate; failed checkout queues nothing',async()=>{
 const body=checkout();created=await request(app).post('/api/checkout').send(body);assert.equal(created.status,201,JSON.stringify(created.body));
 assert.equal((await request(app).post('/api/checkout').send(body)).status,201);
 assert.equal((await fixture.db.query('SELECT COUNT(*)::int n FROM order_alert_events')).rows[0].n,1);
 assert.equal((await fixture.db.query('SELECT COUNT(*)::int n FROM order_alert_deliveries')).rows[0].n,1);
 const failed=await request(app).post('/api/checkout').send({...checkout(),items:[{productId:999999,qty:1}]});assert.equal(failed.status,409);
 assert.equal((await fixture.db.query('SELECT COUNT(*)::int n FROM order_alert_events')).rows[0].n,1);
 const events=(await request(app).get('/api/manage/orders/alerts?after=0').set(admin)).body.events;assert.equal(events.length,1);assert.equal(events[0].order_number,created.body.order.order_number);assert.equal(events[0].customer_phone,undefined);
});
test('durable dispatch sends once, retries failures and never delivers for revoked staff',async()=>{
 const alerts=require('../backend/services/order-alerts');let sent=0;
 await alerts.dispatch({sendPushFn:async(saved,payload)=>{assert.equal(saved.endpoint,sub.endpoint);assert.doesNotMatch(JSON.stringify(payload),/Private buyer|66232231|Test/);sent++}});
 await alerts.dispatch({sendPushFn:async()=>sent++});assert.equal(sent,1);
 const another=await request(app).post('/api/checkout').send(checkout());assert.equal(another.status,201);
 await alerts.dispatch({sendPushFn:async()=>{throw Error('private key or endpoint must not be logged')}});
 const job=(await fixture.db.query("SELECT * FROM order_alert_deliveries WHERE status='PENDING'")).rows[0];assert.equal(job.attempts,1);assert.equal(job.last_error,'DELIVERY_FAILED');
 await fixture.db.query('UPDATE order_alert_deliveries SET next_attempt_at=NOW()');
 await alerts.dispatch({sendPushFn:async()=>sent++});assert.equal(sent,2);
 await request(app).post('/api/checkout').send(checkout());await fixture.db.query("UPDATE admin_users SET status='INACTIVE' WHERE id=1");
 await alerts.dispatch({sendPushFn:async()=>sent++});assert.equal(sent,2);
 assert.equal((await fixture.db.query("SELECT COUNT(*)::int n FROM order_alert_deliveries WHERE last_error='ACCESS_REVOKED'")).rows[0].n,1);
 await fixture.db.query("UPDATE admin_users SET status='ACTIVE' WHERE id=1");
});
test('orders include product image, bilingual names and safe links; customer estimates stay private',async()=>{
 const list=await request(app).get('/api/admin/orders').set(admin);assert.equal(list.status,200,JSON.stringify(list.body));assert.equal(list.body.orders[0].items[0].product_slug,'rose-lipstick');assert.ok(list.body.orders[0].items[0].product_name_en);assert.ok(list.body.orders[0].items[0].product_name_ar);
 const detail=await request(app).get('/api/admin/orders/'+created.body.order.order_number).set(admin);assert.equal(detail.body.items[0].product_slug,'rose-lipstick');
 const number=created.body.order.order_number;assert.equal((await request(app).get('/api/store/orders/'+number)).status,404);
 const own=await request(app).get('/api/store/orders/'+number).set('x-order-token',created.body.tracking_token);assert.ok(own.body.order.delivery_estimated_to);
 const agent=request.agent(app);const register=await agent.post('/api/customer/register').send({name:'Shopper',phone:'66232231',email:'remember@example.test',password:'A-long-test-password'});assert.equal(register.status,201);assert.match(register.headers['set-cookie'][0],/Max-Age=2592000/);assert.match(register.headers['set-cookie'][0],/HttpOnly/);
 await agent.post('/api/checkout').send(checkout());assert.ok((await agent.get('/api/customer/orders')).body[0].delivery_estimated_to);
 await agent.post('/api/customer/logout').send({});assert.equal((await agent.get('/api/customer/me')).status,401);
});
test('Google config stays hidden without setup; verification binds nonce, audience and existing-account linking',async()=>{
 const google=require('../backend/services/google-signin'),old=google.verify;assert.equal((await request(app).get('/api/customer/google/config')).body.enabled,false);
 process.env.GOOGLE_CLIENT_ID='test.apps.googleusercontent.com';const a=request.agent(app);const cfg=(await a.get('/api/customer/google/config')).body;assert.ok(cfg.nonce);
 const calls=[];google.verify=async(token,nonce,audience)=>{calls.push({nonce,audience});return {sub:'google-test-sub',email:'google@example.test',name:'Google shopper'}};
 try{
  assert.equal((await a.post('/api/customer/google').send({nonce:'bad',credential:'id-token'})).status,401);
  const c=(await a.get('/api/customer/google/config')).body;const ok=await a.post('/api/customer/google').send({nonce:c.nonce,credential:'id-token'});assert.equal(ok.status,200,JSON.stringify(ok.body));assert.equal(calls[0].audience,process.env.GOOGLE_CLIENT_ID);assert.equal((await a.get('/api/customer/me')).status,200);
  assert.equal((await a.post('/api/customer/google').send({nonce:c.nonce,credential:'id-token'})).status,401);
  google.verify=async()=>({sub:'different-sub',email:'remember@example.test',name:'Existing'});const b=request.agent(app),config=(await b.get('/api/customer/google/config')).body;
  assert.equal((await b.post('/api/customer/google').send({nonce:config.nonce,credential:'id-token'})).status,409);
 }finally{google.verify=old;delete process.env.GOOGLE_CLIENT_ID}
});
