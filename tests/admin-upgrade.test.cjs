const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),request=require('supertest'),crypto=require('node:crypto'),sharp=require('sharp');
let fixture,app,admin,photo,stockProduct;
const address={governorate:'Capital',area:'Kuwait City',block:'1',street:'Gharabally',building:'10'};
const checkout=(productId=1,qty=1,extra={})=>({items:[{productId,qty}],payment_method:'COD',idempotencyKey:crypto.randomUUID(),customer:{name:'Test customer',phone:'66232231',address},...extra});
before(async()=>{fixture=await require('./isolated-db.cjs').setup();await fixture.db.query("SELECT setval('admin_users_id_seq',1)");app=require('../backend/app').createApp({localPreview:true});admin={Authorization:'Bearer '+(await request(app).post('/api/admin/auth/login').send({email:'admin@example.test',password:'TestPassword123!'})).body.token};photo='data:image/png;base64,'+(await sharp({create:{width:300,height:300,channels:3,background:'#eeddcc'}}).png().toBuffer()).toString('base64')});after(async()=>fixture?.close());
test('minimal product, decoded image processing, taxonomies, saved filters and audited bulk updates',async()=>{
 assert.equal((await request(app).post('/api/manage/images').set(admin).send({data:'data:image/png;base64,YmFk'})).status,400);
 const upload=await request(app).post('/api/manage/images').set(admin).send({data:photo});assert.equal(upload.status,200,JSON.stringify(upload.body));assert.match(upload.body.url,/\.webp$/);assert.equal(upload.body.width,300);
 const category=await request(app).post('/api/manage/categories').set(admin).send({name_en:'Test category',image_url:upload.body.url});assert.equal(category.status,200,JSON.stringify(category.body));
 const product=await request(app).post('/api/manage/products').set(admin).send({name_en:'New product',how_to_use_en:'Follow the label directions.',how_to_use_ar:'اتبعي تعليمات العبوة.',selling_price:2.5,images:[{url:upload.body.url}],inventory_quantity:2,status:'ACTIVE'});assert.equal(product.status,200,JSON.stringify(product.body));stockProduct=product.body.id;
 const get=await request(app).get('/api/manage/products/'+stockProduct).set(admin);assert.equal(get.body.product.category.name_en,'Uncategorized');assert.equal(get.body.product.inventory_quantity,2);assert.equal(get.body.product.how_to_use_en,'Follow the label directions.');assert.equal(get.body.product.content_sections.ar.how_to_use,'اتبعي تعليمات العبوة.');
 const missing=await request(app).post('/api/manage/products').set(admin).send({name_en:'No image',selling_price:1});assert.equal(missing.status,400);
 const bulk=await request(app).post('/api/manage/products/bulk').set(admin).send({ids:[stockProduct],action:'archive'});assert.equal(bulk.body.updated,1);assert.equal((await request(app).get('/api/products/'+product.body.slug)).status,404);
 await request(app).post('/api/manage/products/bulk').set(admin).send({ids:[stockProduct],action:'publish'});
 const filters=await request(app).get('/api/manage/products?inventory=low&sort=quantity-asc').set(admin);assert.equal(filters.body.total,1);assert.equal(filters.body.products[0].id,stockProduct);
 assert.equal((await request(app).post('/api/manage/product-views').set(admin).send({name:'Low stock',filters:{inventory:'low',unsafe:'ignore'}})).status,200);assert.equal((await request(app).get('/api/manage/product-views').set(admin)).body[0].filters.unsafe,undefined);
});
test('staff cannot escalate, owner changes revoke sessions, and customer JWTs cannot authenticate as admin',async()=>{
 const create=await request(app).post('/api/manage/users').set(admin).send({email:'staff@example.test',name:'Catalog editor',password:'TestPassword123!',role:'STAFF',permissions:['products']});assert.equal(create.status,200,JSON.stringify(create.body));
 const login=await request(app).post('/api/customer/login').send({email:'staff@example.test',password:'TestPassword123!'});assert.equal(login.status,200);assert.ok(login.body.admin);const staff={Authorization:'Bearer '+login.body.token};
 assert.equal((await request(app).get('/api/manage/products').set(staff)).status,200);assert.equal((await request(app).get('/api/manage/users').set(staff)).status,403);assert.equal((await request(app).get('/api/admin/orders').set(staff)).status,403);assert.equal((await request(app).get('/api/manage/settings').set(staff)).status,403);
 await request(app).put('/api/manage/users/'+create.body.id).set(admin).send({email:'staff@example.test',role:'STAFF',status:'INACTIVE',permissions:[]});assert.equal((await request(app).get('/api/manage/session').set(staff)).status,401);
 const jwt=require('jsonwebtoken').sign({id:1,role:'CUSTOMER',version:0},process.env.ADMIN_JWT_SECRET,{audience:'mikyaj-customer'});assert.equal((await request(app).get('/api/manage/session').set('Authorization','Bearer '+jwt)).status,401);
 assert.equal((await request(app).put('/api/manage/users/1').set(admin).send({email:'admin@example.test',role:'STAFF',status:'ACTIVE'})).status,400);
});
test('tracked stock reserves once, overselling fails, cancellation restores once',async()=>{
 const b=checkout(stockProduct,2);const created=await request(app).post('/api/checkout').send(b);assert.equal(created.status,201,JSON.stringify(created.body));assert.equal((await request(app).post('/api/checkout').send(b)).status,201);
 assert.equal((await fixture.db.query('SELECT inventory_quantity FROM products WHERE id=$1',[stockProduct])).rows[0].inventory_quantity,0);
 assert.equal((await request(app).post('/api/checkout').send(checkout(stockProduct,1))).status,409);
 const order=created.body.order.order_number;assert.equal((await request(app).post('/api/admin/orders/'+order+'/cancel').set(admin).send({reason:'Stock test cancellation'})).status,200);await request(app).post('/api/admin/orders/'+order+'/cancel').set(admin).send({reason:'Retry'});
 assert.equal((await fixture.db.query('SELECT inventory_quantity FROM products WHERE id=$1',[stockProduct])).rows[0].inventory_quantity,2);
});
test('discounts use integer fils, usage reservations and expiry, with free delivery preserved',async()=>{
 const created=await request(app).post('/api/manage/discounts').set(admin).send({title:'Ten percent',type:'ORDER',method:'CODE',code:'TEST10',value_type:'PERCENT',value:10,usage_limit:1});assert.equal(created.status,200,JSON.stringify(created.body));
 const quote=await request(app).post('/api/store/quote').send({items:[{productId:1,qty:1}],area:'Kuwait City',discount_code:'TEST10'});assert.equal(quote.body.total,'3.700');
 const b=checkout(1,1,{discount_code:'TEST10'}),order=await request(app).post('/api/checkout').send(b);assert.equal(order.status,201,JSON.stringify(order.body));assert.equal((await request(app).post('/api/checkout').send(b)).status,201);assert.equal((await request(app).post('/api/checkout').send(checkout(1,1,{discount_code:'TEST10'}))).status,400);
 await request(app).post('/api/admin/orders/'+order.body.order.order_number+'/cancel').set(admin).send({reason:'Restore discount reservation'});
 assert.equal((await request(app).post('/api/store/quote').send({items:[{productId:3,qty:2}],area:'Kuwait City',discount_code:'TEST10'})).body.total,'9.000');
 await request(app).patch('/api/manage/discounts/'+created.body.id).set(admin).send({active:false});
 const bx=await request(app).post('/api/manage/discounts').set(admin).send({title:'Buy one get one',type:'BXGY',method:'AUTOMATIC',value_type:'PERCENT',value:100,buy_quantity:1,get_quantity:1,target:'ALL',get_target:'ALL'});assert.equal(bx.status,200);
 const q=await request(app).post('/api/store/quote').send({items:[{productId:1,qty:2}],area:'Kuwait City'});assert.equal(q.body.discount_amount,'3.000');assert.equal(q.body.total,'4.000');await request(app).patch('/api/manage/discounts/'+bx.body.id).set(admin).send({active:false});
});
test('return evidence is private and status history is preserved',async()=>{
 const order=(await request(app).post('/api/checkout').send(checkout())).body;for(const status of ['OUT_FOR_DELIVERY','DELIVERED'])await request(app).patch('/api/admin/orders/'+order.order.order_number+'/status').set(admin).send({status});
 const base='/api/store/orders/'+order.order.order_number,token={'x-order-token':order.tracking_token};const r=await request(app).post(base+'/return').set(token).send({reason:'Damaged packaging on arrival',reason_code:'DAMAGED',items:[{product_id:1,quantity:1}],photos:[photo]});assert.equal(r.status,201,JSON.stringify(r.body));const detail=await request(app).get(base+'/returns/'+r.body.id).set(token);const evidence=detail.body.evidence[0].id;
 assert.equal((await request(app).get(base+'/returns/'+r.body.id+'/evidence/'+evidence)).status,404);const image=await request(app).get(base+'/returns/'+r.body.id+'/evidence/'+evidence).set(token);assert.equal(image.status,200);assert.match(image.headers['content-type'],/image\/webp/);assert.match(image.headers['cache-control'],/no-store/);
 assert.equal((await request(app).get('/api/manage/returns/'+r.body.id+'/evidence/'+evidence).set(admin)).status,200);await request(app).patch('/api/manage/returns/'+r.body.id).set(admin).send({status:'APPROVED',admin_note:'Photo checked'});assert.equal((await request(app).get(base+'/returns/'+r.body.id).set(token)).body.history.length,2);
 const whatsapp=await request(app).post(base+'/returns/'+r.body.id+'/whatsapp').set(token).send({});assert.match(whatsapp.body.url,/^https:\/\/wa.me\/96566232231/);
});
test('saved addresses remain owner scoped and default switching is atomic',async()=>{
 const customer=request.agent(app);await customer.post('/api/customer/register').send({email:'address@example.test',name:'Customer',phone:'66232231',password:'TestPassword123!'});const first=(await customer.post('/api/customer/addresses').send(address)).body.id,second=(await customer.post('/api/customer/addresses').send({...address,label:'Office'})).body.id;
 for(const id of [first,second])assert.equal((await customer.put('/api/customer/addresses/'+id).send({...address,is_default:true})).status,200);
 const rows=(await customer.get('/api/customer/addresses')).body;assert.equal(rows.filter(a=>a.is_default).length,1);assert.equal(rows[0].id,second);
});
test('customer pages are complete, searchable and validated',async()=>{
 for(let i=0;i<43;i++)await fixture.db.query('INSERT INTO customers(name,email,password_hash,phone,status) VALUES($1,$2,$3,$4,$5)',['Pagination '+i,`pagination-${i}@example.test`,'unused','+96566232231',i===42?'INACTIVE':'ACTIVE']);
 const first=(await request(app).get('/api/manage/customers/list?search=Pagination&page=1').set(admin)).body;
 const second=(await request(app).get('/api/manage/customers/list?search=Pagination&page=2').set(admin)).body;
 assert.equal(first.total,43);assert.equal(first.customers.length,40);assert.equal(second.customers.length,3);assert.equal(new Set([...first.customers,...second.customers].map(c=>c.id)).size,43);
 assert.equal((await request(app).get('/api/manage/customers/list?search=Pagination&status=INACTIVE').set(admin)).body.total,1);
 assert.equal((await request(app).get('/api/manage/customers/list?page=-1').set(admin)).status,400);
 assert.equal((await request(app).get('/api/manage/customers/list')).status,401);
});
test('checkout settings are enforced and saved order totals expose discounts and tax',async()=>{
 await request(app).put('/api/manage/settings/checkout').set(admin).send({guest_enabled:false,order_note_enabled:false});
 assert.equal((await request(app).post('/api/checkout').send(checkout())).status,401);
 await request(app).put('/api/manage/settings/checkout').set(admin).send({guest_enabled:true,order_note_enabled:false});
 await request(app).put('/api/manage/settings/tax').set(admin).send({enabled:true,rate:5,shipping_taxable:false,label:'Test tax'});
 const discount=await request(app).post('/api/manage/discounts').set(admin).send({title:'Snapshot discount',type:'ORDER',method:'CODE',code:'SNAPSHOT',value_type:'FIXED',value:1});
 const result=await request(app).post('/api/checkout').send(checkout(1,1,{discount_code:'SNAPSHOT',customer:{name:'Test',phone:'66232231',address:{...address,notes:'Disabled note'}}}));assert.equal(result.status,201,JSON.stringify(result.body));
 const number=result.body.order.order_number;
 const saved=(await request(app).get('/api/admin/orders/'+number).set(admin)).body.order;
 assert.equal(JSON.parse(saved.customer_address).notes,'');assert.equal(Number(saved.discount_amount),1);assert.equal(saved.discounts.length,1);assert.equal(Number(saved.tax_amount),0.1);assert.equal(Number(saved.total_amount),3.1);
 const publicOrder=(await request(app).get('/api/store/orders/'+number).set('x-order-token',result.body.tracking_token)).body.order;
 assert.equal(Number(publicOrder.total_amount),3.1);assert.equal(publicOrder.discounts[0].title,'Snapshot discount');
 const search=(await request(app).get('/api/manage/search?q=Snapshot').set(admin)).body;
 assert.match(search.find(g=>g.type==='Discounts').items[0].url,/view=offers&id=/);
 await request(app).patch('/api/manage/discounts/'+discount.body.id).set(admin).send({active:false});
 await request(app).put('/api/manage/settings/tax').set(admin).send({enabled:false,rate:0,shipping_taxable:false,label:'Tax'});
 await request(app).put('/api/manage/settings/checkout').set(admin).send({guest_enabled:true,order_note_enabled:true});
});
test('automatic discounts compare valid combinations instead of incompatible raw sums',async()=>{
 const ids=[];for(const [title,value,combines]of [['Combine A',0.8,true],['Combine B',0.7,true],['Better single',1.2,false]]){const d=await request(app).post('/api/manage/discounts').set(admin).send({title,type:'ORDER',method:'AUTOMATIC',value_type:'FIXED',value,combines});assert.equal(d.status,200);ids.push(d.body.id)}
 const quote=(await request(app).post('/api/store/quote').send({items:[{productId:1,qty:1}],area:'Kuwait City'})).body;
 assert.equal(quote.discount_amount,'1.200');assert.equal(quote.discounts[0].title,'Better single');
 for(const id of ids)await request(app).patch('/api/manage/discounts/'+id).set(admin).send({active:false});
});
test('content, private product fields, tax and analytics are backed by real settings and data',async()=>{
 assert.equal((await request(app).get('/api/manage/analytics').set(admin)).status,200);
 assert.equal((await request(app).get('/api/manage/products?search=lip').set(admin)).status,200);
 const homeSaved=await request(app).put('/api/manage/content/home').set(admin).send({title_en:'A <safe> headline',button_url:'/shop.html',show_categories:false});assert.equal(homeSaved.status,200);
 const home=(await request(app).get('/api/manage/content/home').set(admin)).body;assert.equal(home.show_categories,false);assert.equal(home.title_en,'A <safe> headline');
 // Legacy text settings stay editable through the API; the image-only hero is now managed in Banners.
 const html=await request(app).get('/en/');assert.match(html.text,/hero-welcome-1600\.webp/);assert.doesNotMatch(html.text,/class="hero-copy"|A &lt;safe&gt; headline/);
 assert.equal((await request(app).put('/api/manage/content/home').set(admin).send({title_en:'Bad link',button_url:'javascript:alert(1)'})).status,400);
 await request(app).put('/api/manage/settings/product-fields').set(admin).send({definitions:[{key:'finish',type:'text',label_en:'Finish',label_ar:'اللمسة',visible:true},{key:'internal',type:'text',label_en:'Internal',visible:false}]});
 await fixture.db.query('UPDATE products SET custom_fields=$1 WHERE id=1',[{finish:'Matte',internal:'Private note'}]);const p=(await request(app).get('/api/products/rose-lipstick')).body.product;assert.equal(p.custom_fields,undefined);assert.deepEqual(p.custom_field_display.map(f=>f.value),['Matte']);
 const setting=await request(app).put('/api/manage/settings/tax').set(admin).send({enabled:true,rate:5,shipping_taxable:false,label:'Test tax'});assert.equal(setting.status,200);
 const quote=await request(app).post('/api/store/quote').send({items:[{productId:1,qty:1}],area:'Kuwait City'});assert.equal(quote.body.tax_amount,'0.150');assert.equal(quote.body.total,'4.150');
 await request(app).put('/api/manage/settings/tax').set(admin).send({enabled:false,rate:0,shipping_taxable:false,label:'Tax'});
 assert.equal((await request(app).post('/api/store/quote').send({items:[{productId:3,qty:2}],area:'Unconfigured area'})).body.delivery_available,false);
 await request(app).put('/api/manage/settings/events').set(admin).send({enabled:false});
 const event={session_id:crypto.randomUUID(),event:'page_view',path:'/en/',device:'mobile'};await request(app).post('/api/events').send(event);assert.equal((await fixture.db.query('SELECT COUNT(*)::int n FROM commerce_events')).rows[0].n,0);
 await request(app).put('/api/manage/settings/events').set(admin).send({enabled:true});await request(app).post('/api/events').set('DNT','1').send(event);assert.equal((await fixture.db.query('SELECT COUNT(*)::int n FROM commerce_events')).rows[0].n,0);await request(app).post('/api/events').send(event);const report=(await request(app).get('/api/manage/analytics').set(admin)).body;assert.equal(report.traffic.sessions,1);assert.equal(report.devices[0].device,'mobile');
});
test('partial returns do not mark the whole order returned or permit duplicate quantities',async()=>{
 const order=(await request(app).post('/api/checkout').send(checkout(1,2))).body;for(const status of ['OUT_FOR_DELIVERY','DELIVERED'])await request(app).patch('/api/admin/orders/'+order.order.order_number+'/status').set(admin).send({status});const base='/api/store/orders/'+order.order.order_number,token={'x-order-token':order.tracking_token};
 const first=await request(app).post(base+'/return').set(token).send({reason:'One item has damaged packaging',items:[{product_id:1,quantity:1}]});assert.equal(first.status,201);for(const status of ['APPROVED','RECEIVED','CLOSED'])assert.equal((await request(app).patch('/api/manage/returns/'+first.body.id).set(admin).send({status})).status,200);assert.equal((await request(app).get(base).set(token)).body.order.status,'DELIVERED');
 assert.equal((await request(app).post(base+'/return').set(token).send({reason:'Request too many returned items',items:[{product_id:1,quantity:2}]})).status,409);
 const remaining=await request(app).post(base+'/return').set(token).send({reason:'The other item also arrived damaged',items:[{product_id:1,quantity:1}]});assert.equal(remaining.status,201);for(const status of ['APPROVED','RECEIVED'])await request(app).patch('/api/manage/returns/'+remaining.body.id).set(admin).send({status});assert.equal((await request(app).get(base).set(token)).body.order.status,'RETURNED');
});
