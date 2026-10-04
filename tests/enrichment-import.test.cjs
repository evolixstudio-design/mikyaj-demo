const {test}=require('node:test'),assert=require('node:assert/strict');
const {importDetails}=require('../scripts/import-catalog-details.cjs');
test('enrichment requires exact identity and approval, rolls back dry runs and preserves existing descriptions',async()=>{
 const fixture=await require('./isolated-db.cjs').setup();const client=await fixture.db.pool.connect();
 try{const data={brands:[{name:'Rose',slug:'rose'}],products:[{id:1,source_url:'test:1',status:'FETCHED',details_ar:'تفاصيل جديدة',short_description_ar:'',brands:[{name:'Rose',slug:'rose'}],approved:true},{id:2,source_url:'wrong',status:'FETCHED',details_ar:'Wrong identity',approved:true},{id:3,source_url:'test:3',status:'FETCHED',details_ar:'Unreviewed'}]};
 const dry=await importDetails(client,data);assert.equal(dry.approved,1);assert.equal((await client.query('SELECT details_ar FROM products WHERE id=1')).rows[0].details_ar,null);await importDetails(client,data,true);const p=(await client.query('SELECT details_ar,brand_id,translation_status FROM products WHERE id=1')).rows[0];assert.equal(p.details_ar,'تفاصيل جديدة');assert.ok(p.brand_id);assert.equal(p.translation_status,'PENDING');data.products[0].details_ar='Replacement';await importDetails(client,data,true);assert.equal((await client.query('SELECT details_ar FROM products WHERE id=1')).rows[0].details_ar,'تفاصيل جديدة');assert.equal((await client.query('SELECT details_ar FROM products WHERE id=2')).rows[0].details_ar,null);
 }finally{client.release();await fixture.close()}
});
