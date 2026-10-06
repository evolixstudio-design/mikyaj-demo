const {test}=require('node:test'),assert=require('node:assert/strict');
test('catalog transfer is dry-run by default, guards changed copy and preserves deletion history',async()=>{
 const fixture=await require('./isolated-db.cjs').setup();const {applyCatalog,hash}=require('../scripts/apply-reviewed-catalog.cjs');
 try{const original=(await fixture.db.query('SELECT * FROM products WHERE id=1')).rows[0];const release={id:'test-release',products:[{...original,baseline_hash:hash(original),source_hash:hash(original),name_en:'New English copy',brand_slug:'test-brand'}],categories:[],brands:[{name:'Test brand',name_en:'Test brand',name_ar:'',search_aliases:'',slug:'test-brand',image_url:'/assets/images/taxonomy/brand-test.webp',image_alt_en:'Test brand',image_alt_ar:''}],removals:[{slug:'lip-liner',name_ar:'قلم تحديد الشفاه'}]};
 let client=await fixture.db.pool.connect();try{assert.equal((await applyCatalog(client,release)).committed,false)}finally{client.release()}
 assert.equal((await fixture.db.query('SELECT name_en FROM products WHERE id=1')).rows[0].name_en,'Rose lipstick');
 client=await fixture.db.pool.connect();try{const result=await applyCatalog(client,release,{commit:true});assert.equal(result.translated,1);assert.equal(result.removed,1)}finally{client.release()}
 assert.equal((await fixture.db.query('SELECT count(*)::int n FROM catalog_release_backups')).rows[0].n,3);assert.ok((await fixture.db.query('SELECT brand_id FROM products WHERE id=1')).rows[0].brand_id);assert.ok((await fixture.db.query('SELECT deleted_at FROM products WHERE id=2')).rows[0].deleted_at);
 await fixture.db.query("UPDATE products SET translation_status='REVIEWED',name_en='Editorial correction' WHERE id=1");client=await fixture.db.pool.connect();try{const result=await applyCatalog(client,release,{commit:true});assert.equal(result.translated,0);assert.equal(result.removed,0)}finally{client.release()}
 assert.equal((await fixture.db.query('SELECT name_en FROM products WHERE id=1')).rows[0].name_en,'Editorial correction');
 }finally{await fixture.close()}
});
