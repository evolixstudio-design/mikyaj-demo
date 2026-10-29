const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),request=require('supertest');
let fixture,app,auth,id,variants=[];
before(async()=>{fixture=await require('./isolated-db.cjs').setup();app=require('../backend/app').createApp();const login=await request(app).post('/api/admin/auth/login').send({email:'admin@example.test',password:'TestPassword123!'});assert.equal(login.status,200);auth={Authorization:'Bearer '+login.body.token};});
after(async()=>fixture?.close());
test('fragrance metadata is validated, preserves private fields and defaults old products to shades',async()=>{
 id=(await fixture.db.query("INSERT INTO products(source_url,source_identity_hash,name_ar,name_en,slug,source_price,selling_price,category_id,custom_fields) VALUES('test:fragrance','hash-fragrance','غسول عطري','Fragrance wash','fragrance-wash',1.89,1.89,2,'{\"private_import_note\":\"never public\"}') RETURNING id")).rows[0].id;
 assert.equal((await request(app).get('/api/products/rose-lipstick')).body.product.variant_type,'shade');
 assert.equal((await request(app).put('/api/manage/products/'+id+'/variants').set(auth).send({enabled:false,variant_type:'<script>'})).status,400);
 assert.equal((await request(app).put('/api/manage/products/'+id+'/variants').set(auth).send({enabled:false,variant_type:'fragrance'})).status,200);
 const stored=(await fixture.db.query('SELECT custom_fields FROM products WHERE id=$1',[id])).rows[0].custom_fields;
 assert.equal(stored.private_import_note,'never public');assert.equal(stored.variant_type,'fragrance');
 const product=(await request(app).get('/api/products/fragrance-wash')).body.product;
 assert.equal(product.variant_type,'fragrance');assert.equal(product.custom_fields,undefined);
 assert.equal((await request(app).get('/api/manage/products/'+id+'/variants').set(auth)).body.variant_type,'fragrance');
});
test('all four options share the parent price and server quote requires an available option belonging to that product',async()=>{
 for(const [index,name]of ['Rose','Tea tree','Lemon','Lavender'].entries()){
  const r=await request(app).post('/api/manage/products/'+id+'/variants').set(auth).send({name_en:name,name_ar:'رائحة '+index,color_hex:'#ffffff',status:'ACTIVE',stock_status:'IN_STOCK',inventory_quantity:null});assert.equal(r.status,200);variants.push(r.body);
 }
 assert.equal((await request(app).put('/api/manage/products/'+id+'/variants').set(auth).send({enabled:true})).status,200);
 const product=(await request(app).get('/api/products/fragrance-wash')).body.product;assert.equal(product.variant_type,'fragrance');assert.equal(product.variants.length,4);assert.equal(product.has_shades,true);
 const grid=(await request(app).get('/api/products?search=Fragrance%20wash')).body.products[0];assert.equal(grid.variant_type,'fragrance');assert.equal(grid.custom_fields,undefined);
 const quote=items=>request(app).post('/api/store/quote').send({items,area:'Kuwait City'});
 assert.equal((await quote([{productId:id,qty:1}])).status,409);
 for(const variant of variants){const r=await quote([{productId:id,variantId:variant.id,qty:1,price:0.001}]);assert.equal(r.status,200);assert.equal(r.body.subtotal,'1.890');assert.equal(r.body.items[0].variant_name_en,variant.name_en);}
 assert.equal((await quote([{productId:1,variantId:variants[0].id,qty:1}])).status,409);
 await fixture.db.query("UPDATE product_variants SET stock_status='OUT_OF_STOCK' WHERE id=$1",[variants[0].id]);assert.equal((await quote([{productId:id,variantId:variants[0].id,qty:1}])).status,409);
});
