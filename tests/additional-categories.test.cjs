const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),request=require('supertest');
let fixture,app,admin,category;
before(async()=>{fixture=await require('./isolated-db.cjs').setup();app=require('../backend/app').createApp({localPreview:true});admin={Authorization:'Bearer '+(await request(app).post('/api/admin/auth/login').send({email:'admin@example.test',password:'TestPassword123!'})).body.token};});
after(async()=>fixture?.close());

test('additional categories preserve primary categories, filter without duplicates and set featured priority',async()=>{
 const created=await request(app).post('/api/manage/categories').set(admin).send({name_en:'Korean Skincare',name_ar:'العناية الكورية بالبشرة',slug:'korean-skincare',priority:1000,badge_en:'Trending',badge_ar:'رائج الآن'});
 assert.equal(created.status,200,JSON.stringify(created.body));category=created.body;
 assert.equal((await request(app).post('/api/manage/products/bulk').send({ids:[3,4],action:'add_category',value:category.id})).status,401);
 for(let repeat=0;repeat<2;repeat++){const added=await request(app).post('/api/manage/products/bulk').set(admin).send({ids:[3,4],action:'add_category',value:category.id});assert.equal(added.status,200);}
 assert.equal((await fixture.db.query('SELECT count(*)::int AS n FROM product_category_memberships')).rows[0].n,2);
 assert.deepEqual((await fixture.db.query('SELECT category_id FROM products WHERE id IN (3,4) ORDER BY id')).rows.map(p=>p.category_id),[2,2]);
 const categories=(await request(app).get('/api/categories')).body;assert.equal(categories[0].id,category.id);assert.equal(categories[0].badge_en,'Trending');
 const sorted=(await request(app).get('/api/products')).body.products;assert.deepEqual(sorted.slice(0,2).map(p=>p.id),[4,3]);assert.equal(sorted[0].category.slug,'skin');assert.equal(sorted[0].featured_category.slug,'korean-skincare');
 assert.deepEqual((await request(app).get('/api/store/recommendations')).body.products.slice(0,2).map(p=>p.id),[4,3]);
 const original=(await request(app).get('/api/products?category=skin')).body.products;assert.deepEqual(original.map(p=>p.id),[4,3]);
 const additional=await request(app).get('/api/manage/products?category=korean-skincare').set(admin);assert.equal(additional.body.total,2);
 const first=(await request(app).get('/api/products?category=korean-skincare&limit=1')).body;const second=(await request(app).get('/api/products?category=korean-skincare&limit=1&cursor='+first.next_cursor)).body;assert.deepEqual([first.products[0].id,second.products[0].id],[4,3]);assert.equal(second.next_cursor,null);
 await request(app).post('/api/manage/products/bulk').set(admin).send({ids:[1],action:'add_category',value:1});assert.equal((await request(app).get('/api/manage/products?category=lmkyj').set(admin)).body.total,2);
});

test('product editing manages additional categories, preserves omitted membership and rejects invalid IDs atomically',async()=>{
 const original=(await request(app).get('/api/manage/products/3').set(admin)).body.product;
 const body={...original,images:[{url:'https://res.cloudinary.com/example/image/upload/cleanser.webp'}],additional_category_ids:[category.id,category.id],selling_price:original.base_price};
 const saved=await request(app).put('/api/manage/products/3').set(admin).send(body);assert.equal(saved.status,200,JSON.stringify(saved.body));
 const current=(await request(app).get('/api/products/face-cleanser')).body.product;assert.equal(current.category.id,2);assert.equal(current.additional_categories.length,1);assert.equal(current.additional_categories[0].id,category.id);
 delete body.additional_category_ids;assert.equal((await request(app).put('/api/manage/products/3').set(admin).send(body)).status,200);assert.equal((await request(app).get('/api/products/face-cleanser')).body.product.additional_categories.length,1);
 for(const invalid of [[999999],['3 OR 1=1'],{},Array(21).fill(category.id)]){const bad=await request(app).put('/api/manage/products/3').set(admin).send({...body,name_en:'Should roll back',additional_category_ids:invalid});assert.equal(bad.status,400);assert.equal((await fixture.db.query('SELECT name_en FROM products WHERE id=3')).rows[0].name_en,'Face cleanser');}
});

test('additional-category offers use authoritative prices and inactive collections do not affect public sorting',async()=>{
 const offer=await request(app).post('/api/manage/offers').set(admin).send({title_en:'Category offer',title_ar:'عرض الفئة',category_id:category.id,discount_percent:20,priority:10});assert.equal(offer.status,200,JSON.stringify(offer.body));
 const quote=await request(app).post('/api/store/quote').send({items:[{productId:3,qty:1,price:0.001}],area:'Kuwait City'});assert.equal(quote.body.subtotal,'4.000');assert.equal((await request(app).get('/api/products/face-cleanser')).body.product.selling_price,'4.000');
 await fixture.db.query("UPDATE categories SET status='INACTIVE' WHERE id=$1",[category.id]);
 assert.equal((await request(app).get('/api/manage/products?category=korean-skincare').set(admin)).body.total,2);
 assert.equal((await request(app).get('/api/products?category=korean-skincare')).body.products.length,0);assert.equal((await request(app).get('/api/products')).body.products[0].category.id,1);assert.equal((await request(app).get('/api/products/face-cleanser')).body.product.selling_price,'5.000');
 await fixture.db.query("UPDATE categories SET status='ACTIVE' WHERE id=$1",[category.id]);await request(app).patch('/api/manage/offers/'+offer.body.id).set(admin).send({active:false});
});

test('bilingual collection routes are indexable and removing membership leaves primary category untouched',async()=>{
 for(const lang of ['en','ar']){const response=await request(app).get('/'+lang+'/categories/korean-skincare');assert.equal(response.status,200);assert.match(response.text,/face-cleanser/);assert.match(response.text,/hreflang="ar"/);}
 assert.match((await request(app).get('/sitemap-categories.xml')).text,/en\/categories\/korean-skincare/);
 const removed=await request(app).post('/api/manage/products/bulk').set(admin).send({ids:[3],action:'remove_category',value:category.id});assert.equal(removed.status,200);assert.equal((await fixture.db.query('SELECT category_id FROM products WHERE id=3')).rows[0].category_id,2);assert.equal((await request(app).get('/api/products?category=korean-skincare')).body.products.length,1);
});
