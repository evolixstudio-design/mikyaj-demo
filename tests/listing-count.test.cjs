const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),request=require('supertest'),fs=require('node:fs');
let fixture,app,admin,manualId,importedId;
const image='https://res.cloudinary.com/example/image/upload/listing.webp';
before(async()=>{fixture=await require('./isolated-db.cjs').setup();
 // The fixture inserts its initial catalogue after migrations. Treat it as baseline data.
 await fixture.db.query('DELETE FROM product_listing_ledger');
 app=require('../backend/app').createApp({localPreview:true});admin={Authorization:'Bearer '+(await request(app).post('/api/admin/auth/login').send({email:'admin@example.test',password:'TestPassword123!'})).body.token};
});
after(async()=>fixture?.close());
const report=async()=>{const r=await request(app).get('/api/manage/listing-count').set(admin);assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};

test('initial catalogue is excluded and each successful new admin product adds one ₹11 listing',async()=>{
 assert.equal((await request(app).get('/api/manage/listing-count')).status,401);assert.equal((await report()).summary.billable_listings,0);
 const payload={name_en:'New admin listing',name_ar:'منتج جديد',selling_price:3,images:[{url:image}],status:'INACTIVE',slug:'new-admin-listing'};
 const created=await request(app).post('/api/manage/products').set(admin).send(payload);assert.equal(created.status,200,JSON.stringify(created.body));manualId=created.body.id;
 const counted=await report();assert.equal(counted.summary.admin_created,1);assert.equal(counted.summary.billable_listings,1);assert.equal(counted.summary.amount_paise,1100);assert.equal(counted.rows[0].product_reference,manualId);
 assert.equal((await request(app).post('/api/manage/products').set(admin).send(payload)).status,409);assert.equal((await report()).summary.billable_listings,1);
 const invalid=await request(app).post('/api/manage/products').set(admin).send({...payload,slug:'rolled-back-listing',additional_category_ids:[999999]});assert.equal(invalid.status,400);assert.equal((await report()).summary.billable_listings,1);
});

test('new imports count, updates do not, and migration backfill is repeatable without counting originals',async()=>{
 importedId=(await fixture.db.query("INSERT INTO products(source_url,source_identity_hash,name_en,name_ar,slug,source_price,selling_price,category_id) VALUES('supplier-catalogue://test/new','listing-import-hash','Imported new product','منتج مستورد','imported-new-product',2,3.2,2) RETURNING id")).rows[0].id;
 await fixture.db.query("UPDATE products SET name_en='Edited original product' WHERE id=1");
 const before=await report();assert.equal(before.summary.admin_created,1);assert.equal(before.summary.imported_new,1);assert.equal(before.summary.billable_listings,2);assert.equal(before.summary.amount_paise,2200);
 for(let repeat=0;repeat<2;repeat++)await fixture.pg.exec(fs.readFileSync('database/migrations/023-product-listing-counter.sql','utf8'));
 assert.equal((await report()).summary.billable_listings,2);assert.equal((await report()).summary.other_new,0);
});

test('editing, category changes, soft deletion and hard deletion preserve the once-only work count',async()=>{
 const edited=await request(app).put('/api/manage/products/'+manualId).set(admin).send({name_en:'Edited listing name',selling_price:4,images:[{url:image}],category_id:2,status:'ACTIVE'});assert.equal(edited.status,200);
 await request(app).post('/api/manage/products/bulk').set(admin).send({ids:[manualId],action:'out_of_stock'});
 await request(app).patch('/api/manage/products/'+manualId+'/state').set(admin).send({action:'delete'});
 await fixture.db.query('DELETE FROM products WHERE id=$1',[importedId]);
 const kept=await report();assert.equal(kept.summary.billable_listings,2);assert.equal(kept.summary.amount_paise,2200);assert.equal(kept.rows.find(r=>r.product_reference===manualId).name_en,'New admin listing');assert.equal(kept.rows.find(r=>r.product_reference===importedId).slug,null);
});

test('future insert sources are counted and reporting is private and paginated without exposing supplier costs',async()=>{
 await fixture.db.query("INSERT INTO products(source_url,source_identity_hash,name_en,name_ar,slug,source_price,selling_price,category_id) VALUES('new-upload:test','future-other-hash','Other new listing','منتج آخر','other-new-listing',1,1.6,2)");
 const total=await report();assert.equal(total.summary.billable_listings,3);assert.equal(total.summary.other_new,1);assert.equal(total.summary.amount_paise,3300);assert.equal(total.settings.currency,'INR');
 const first=(await request(app).get('/api/manage/listing-count?limit=1').set(admin)).body;assert.equal(first.rows.length,1);assert.equal(first.next_offset,1);
 const second=(await request(app).get('/api/manage/listing-count?limit=1&offset=1').set(admin)).body;assert.notEqual(first.rows[0].id,second.rows[0].id);
 assert.equal((await request(app).get('/api/manage/listing-count?limit=9999').set(admin)).status,400);
 const staff=(await fixture.db.query("INSERT INTO admin_users(email,password_hash,role,permissions) VALUES('staff-listing@example.test','unused','STAFF','[]') RETURNING id,role,session_version")).rows[0];const token=require('jsonwebtoken').sign(staff,process.env.ADMIN_JWT_SECRET);
 assert.equal((await request(app).get('/api/manage/listing-count').set('Authorization','Bearer '+token)).status,403);
 for(const row of total.rows)for(const key of ['source_price','selling_price','source_url','custom_fields'])assert.equal(row[key],undefined);
});
