const {test}=require('node:test');
const assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {applyReferences}=require('../scripts/migrate-media-r2.cjs');

test('batched migration preserves concurrent edits, nested settings and supports rollback',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`CREATE TABLE product_images(id integer PRIMARY KEY,cloudinary_url text);
   CREATE TABLE product_variants(id bigint PRIMARY KEY,image_url text);
   CREATE TABLE media_assets(id uuid PRIMARY KEY,url text);
   CREATE TABLE store_settings(key text PRIMARY KEY,value jsonb,updated_at timestamptz);
   INSERT INTO store_settings VALUES('banners','{"items":[{"image_url":"old-banner","title":"Keep me"}],"revision":4}',NOW());`);
  const records=[],uploads=new Map();
  for(let i=1;i<=503;i++){
   const old='old-'+i;await db.query('INSERT INTO product_images VALUES($1,$2)',[i,i===503?'concurrent-edit':old]);
   records.push({table:'product_images',column:'cloudinary_url',id:i,url:old});uploads.set(old,{url:'new-'+i});
  }
  const uuid='12345678-1234-1234-1234-123456789abc';
  await db.query('INSERT INTO media_assets VALUES($1,$2)',[uuid,'old-asset']);
  await db.query('INSERT INTO product_variants VALUES($1,$2)',['9007199254740993','old-variant']);
  records.push({table:'media_assets',column:'url',id:uuid,url:'old-asset'},
   {table:'product_variants',column:'image_url',id:'9007199254740993',url:'old-variant'},
   {table:'store_settings',column:'value',key:'banners',json_path:['items',0,'image_url'],url:'old-banner'});
  for(const name of ['asset','variant','banner'])uploads.set('old-'+name,{url:'new-'+name});
  await db.exec('BEGIN');assert.deepEqual(await applyReferences(db,records,uploads),{changed:505,skipped:1});await db.exec('COMMIT');
  const state=(await db.query('SELECT value FROM store_settings')).rows[0].value;
  assert.equal(state.items[0].image_url,'new-banner');assert.equal(state.items[0].title,'Keep me');assert.equal(state.revision,4);
  assert.equal((await db.query('SELECT cloudinary_url FROM product_images WHERE id=503')).rows[0].cloudinary_url,'concurrent-edit');
  assert.deepEqual(await applyReferences(db,records,uploads,true),{changed:505,skipped:1});
  assert.equal((await db.query('SELECT image_url FROM product_variants')).rows[0].image_url,'old-variant');
  assert.equal((await db.query('SELECT url FROM media_assets')).rows[0].url,'old-asset');
 }finally{await db.close()}
});

test('invalid table is rejected before writes; failed transaction rolls back earlier batches',async()=>{
 const db=new PGlite();
 try{
  await db.exec("CREATE TABLE product_images(id integer PRIMARY KEY,cloudinary_url text); INSERT INTO product_images VALUES(1,'old');");
  const records=[{table:'product_images',column:'cloudinary_url',id:1,url:'old'}],uploads=new Map([['old',{url:'new'}]]);
  await assert.rejects(applyReferences(db,[...records,{table:'customers',column:'email',id:1,url:'old'}],uploads),/Unexpected migration/);
  assert.equal((await db.query('SELECT cloudinary_url FROM product_images')).rows[0].cloudinary_url,'old');
  await db.exec('BEGIN');
  await assert.rejects(applyReferences(db,[...records,{table:'categories',column:'image_url',id:1,url:'old'}],uploads),/categories/);
  await db.exec('ROLLBACK');
  assert.equal((await db.query('SELECT cloudinary_url FROM product_images')).rows[0].cloudinary_url,'old');
 }finally{await db.close()}
});
