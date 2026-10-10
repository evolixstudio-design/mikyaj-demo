const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),request=require('supertest'),crypto=require('node:crypto');
let fixture,app,admin;
const address={governorate:'Capital',area:'Kuwait City',block:'1',street:'Gharabally',building:'10'};
const checkout=(items,extra={})=>({items,payment_method:'COD',idempotencyKey:crypto.randomUUID(),customer:{name:'Parcel <test>',phone:'66232231',address},...extra});
before(async()=>{fixture=await require('./isolated-db.cjs').setup();app=require('../backend/app').createApp({localPreview:true});const login=await request(app).post('/api/admin/auth/login').send({email:'admin@example.test',password:'TestPassword123!'});admin={Authorization:'Bearer '+login.body.token}});
after(async()=>fixture?.close());
test('official area/block directory, owner fee overrides and postal validation',async()=>{
 const config=(await request(app).get('/api/store/config')).body;
 assert.equal(config.delivery_directory.length,136);assert.equal(config.delivery_directory.flatMap(a=>a.blocks).length,1396);
 assert.ok(config.delivery_directory.every(a=>config.governorates.includes(a.governorate)),JSON.stringify([...new Set(config.delivery_directory.map(a=>a.governorate))]));
 const area=config.delivery_directory.find(a=>a.governorate==='Hawalli'),block=area.blocks[0];
 const {address:validate}=require('../backend/services/commerce-quote');
 assert.equal(validate({...address,area:area.name_en,governorate:area.governorate,block:block.block,postal_code:block.postal_code}).postal_code,block.postal_code);
 assert.throws(()=>validate({...address,area:area.name_en,governorate:area.governorate,block:block.block,postal_code:'99999'}),/does not match/);
 const save=await request(app).put('/api/manage/settings/delivery').set(admin).send({...config.delivery,areas:config.delivery.areas.map(a=>({...a,fee:a.name_en===area.name_en?1.5:a.fee})),estimate_min_days:2,estimate_max_days:4});assert.equal(save.status,200,JSON.stringify(save.body));
 const q=(await request(app).post('/api/store/quote').send({items:[{productId:1,qty:1}],area:area.name_ar})).body;assert.equal(q.delivery_fee,'1.500');
 assert.equal((await request(app).post('/api/store/quote').send({items:[{productId:3,qty:2}],area:area.name_en})).body.delivery_fee,'0.000');
});
test('published shades reserve their own stock, hide drafts and preserve order snapshots',async()=>{
 const base={name_en:'Rose',name_ar:'وردي',color_hex:'#c07b85',sku:'ROSE-1',inventory_quantity:2,status:'ACTIVE',stock_status:'IN_STOCK'};
 const shade=await request(app).post('/api/manage/products/1/variants').set(admin).send(base);assert.equal(shade.status,200,JSON.stringify(shade.body));const variantId=Number(shade.body.id);
 await request(app).post('/api/manage/products/1/variants').set(admin).send({...base,name_en:'Draft shade',status:'DRAFT'});
 assert.equal((await request(app).get('/api/products/rose-lipstick')).body.product.has_shades,false);
 assert.equal((await request(app).put('/api/manage/products/1/variants').set(admin).send({enabled:true})).status,200);
 const publicProduct=(await request(app).get('/api/products/rose-lipstick')).body.product;assert.equal(publicProduct.variants.length,1);assert.equal(publicProduct.has_shades,true);
 assert.equal((await request(app).post('/api/store/quote').send({items:[{productId:1,qty:1}],area:'Kuwait City'})).status,409);
 const order=await request(app).post('/api/checkout').send(checkout([{productId:1,variantId,qty:2}]));assert.equal(order.status,201,JSON.stringify(order.body));assert.match(order.body.order.order_number,/^\d{4}$/);
 assert.equal((await fixture.db.query('SELECT inventory_quantity FROM product_variants WHERE id=$1',[variantId])).rows[0].inventory_quantity,0);
 assert.equal((await request(app).post('/api/checkout').send(checkout([{productId:1,variantId,qty:1}]))).status,409);
 const number=order.body.order.order_number,headers={'x-order-token':order.body.tracking_token},detail=(await request(app).get('/api/store/orders/'+number).set(headers)).body;
 assert.equal(detail.items[0].variant_name_en,'Rose');assert.ok(detail.order.delivery_estimated_from);assert.ok(detail.order.delivery_estimated_to);
 assert.equal((new Date(detail.order.delivery_estimated_to)-new Date(detail.order.delivery_estimated_from))/86400000,2);
 assert.equal((await request(app).get('/api/store/orders/'+number+'/document')).status,404);
 const receipt=await request(app).get('/api/store/orders/'+number+'/document').set(headers);assert.equal(receipt.status,200);assert.match(receipt.body.html,/Parcel &lt;test&gt;/);assert.match(receipt.body.html,/Rose/);assert.match(receipt.body.html,/Amount to collect: 7\.000 KWD/);assert.match(receipt.headers['cache-control'],/no-store/);
 const label=await request(app).get('/api/manage/orders/'+number+'/document?kind=label&lang=ar').set(admin);assert.equal(label.status,200);assert.match(label.body.html,/100mm 150mm/);assert.match(label.body.html,/ملصق الطرد/);
 await request(app).post('/api/admin/orders/'+number+'/cancel').set(admin).send({reason:'Stock restoration test'});await request(app).post('/api/admin/orders/'+number+'/cancel').set(admin).send({reason:'Repeated cancellation'});
 assert.equal((await fixture.db.query('SELECT inventory_quantity FROM product_variants WHERE id=$1',[variantId])).rows[0].inventory_quantity,2);
 await request(app).put('/api/manage/products/1/variants/'+variantId).set(admin).send({...base,name_en:'Changed shade'});assert.match((await request(app).get('/api/store/orders/'+number+'/document').set(headers)).body.html,/Rose/);
 await request(app).put('/api/manage/products/1/variants').set(admin).send({enabled:false});
});
test('short order counter grows beyond 9999; sequential numbers do not grant private order access',async()=>{
 await fixture.db.query('UPDATE order_reference_counter SET value=9999 WHERE id=1');
 const body=checkout([{productId:2,qty:1}]),order=await request(app).post('/api/checkout').send(body);assert.equal(order.status,201);assert.equal(order.body.order.order_number,'10000');
 assert.equal((await request(app).post('/api/checkout').send(body)).body.order.order_number,'10000');
 assert.equal((await request(app).get('/api/store/orders/10000')).status,404);
 assert.equal((await request(app).get('/api/manage/orders/10000/document')).status,401);
});
test('two shades of one product cannot turn a partial return into a full return',async()=>{
 const base={name_en:'Coral',name_ar:'مرجاني',color_hex:'#c67765',inventory_quantity:2,status:'ACTIVE',stock_status:'IN_STOCK'};
 const second=(await request(app).post('/api/manage/products/1/variants').set(admin).send(base)).body;
 const first=(await request(app).get('/api/manage/products/1/variants').set(admin)).body.variants.find(v=>v.status==='ACTIVE');
 await request(app).put('/api/manage/products/1/variants').set(admin).send({enabled:true});
 const result=await request(app).post('/api/checkout').send(checkout([{productId:1,variantId:Number(first.id),qty:1},{productId:1,variantId:Number(second.id),qty:1}]));assert.equal(result.status,201,JSON.stringify(result.body));
 const number=result.body.order.order_number,privateHeaders={'x-order-token':result.body.tracking_token};
 for(const status of ['OUT_FOR_DELIVERY','DELIVERED'])await request(app).patch('/api/admin/orders/'+number+'/status').set(admin).send({status});
 for(let i=0;i<2;i++){const returned=await request(app).post('/api/store/orders/'+number+'/return').set(privateHeaders).send({reason:'One shade arrived with damaged packaging',items:[{product_id:1,quantity:1}]});assert.equal(returned.status,201,JSON.stringify(returned.body));for(const status of ['APPROVED','RECEIVED','CLOSED'])await request(app).patch('/api/manage/returns/'+returned.body.id).set(admin).send({status});assert.equal((await request(app).get('/api/store/orders/'+number).set(privateHeaders)).body.order.status,i===0?'DELIVERED':'RETURNED');}
 await request(app).put('/api/manage/products/1/variants').set(admin).send({enabled:false});
});
test('foreground dwell reports cumulative duration once and excludes private paths and privacy signals',async()=>{
 await request(app).put('/api/manage/settings/events').set(admin).send({enabled:true});
 const event={session_id:crypto.randomUUID(),view_id:crypto.randomUUID(),path:'/en/',device:'mobile'};
 assert.equal((await request(app).post('/api/events').send({...event,event:'page_dwell',duration_ms:1000})).status,400);
 await request(app).post('/api/events').set('Sec-GPC','1').send({...event,event:'page_view'});assert.equal((await fixture.db.query('SELECT COUNT(*)::int n FROM commerce_events')).rows[0].n,0);
 assert.equal((await request(app).post('/api/events').send({...event,event:'page_view',path:'/admin/manage.html'})).status,400);
 assert.equal((await request(app).post('/api/events').send({...event,event:'page_view',path:'/track.html?order=10000'})).status,400);
 await request(app).post('/api/events').send({...event,event:'page_view'});
 for(const duration_ms of [15000,30000,20000])assert.equal((await request(app).post('/api/events').send({...event,event:'page_dwell',duration_ms})).status,204);
 const report=await request(app).get('/api/manage/page-visits?session='+event.session_id).set(admin);assert.equal(report.status,200,JSON.stringify(report.body));assert.equal(Number(report.body.pages[0].duration_ms),30000);assert.equal(report.body.pages[0].views,1);assert.equal(report.body.journey.length,1);
 assert.equal((await request(app).get('/api/manage/page-visits')).status,401);
});
test('bilingual local-business identity, stable favicon and safe journal links are crawlable',async()=>{
 const home=await request(app).get('/ar/');assert.match(home.text,/Burhan al dahabi gen trad co/);assert.match(home.text,/مكياج الكويت/);assert.match(home.text,/pDiAzhB5CHR2yi7CA/);assert.match(home.text,/favicon-192\.png/);
 const markup=require('../backend/services/journal-markup').journalMarkup('[Makeup](/en/categories/lmkyj)\n\n[Unsafe](javascript:alert) <script>');assert.match(markup,/href="\/en\/categories\/lmkyj"/);assert.doesNotMatch(markup,/href="javascript/);assert.match(markup,/&lt;script&gt;/);
 const post=require('../backend/data/journal-october-2026.json')[0];const result=await request(app).post('/api/manage/posts').set(admin).send({...post,status:'PUBLISHED',publish_at:new Date(Date.now()-1000).toISOString()});assert.equal(result.status,200,JSON.stringify(result.body));
 const article=await request(app).get('/en/journal/'+post.slug);assert.equal(article.status,200);assert.match(article.text,/href="\/en\/categories\/lmkyj"/);assert.match(article.text,/BlogPosting/);
});
