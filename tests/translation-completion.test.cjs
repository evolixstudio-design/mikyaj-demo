const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),request=require('supertest');
let fixture,app,admin;
before(async()=>{fixture=await require('./isolated-db.cjs').setup();app=require('../backend/app').createApp();admin={Authorization:'Bearer '+(await request(app).post('/api/admin/auth/login').send({email:'admin@example.test',password:'TestPassword123!'})).body.token}});
after(async()=>fixture?.close());
test('completes MACHINE descriptions without replacing names or reviewed products',async()=>{
 await fixture.pg.exec("UPDATE products SET translation_status='REVIEWED'; UPDATE products SET translation_status='MACHINE',name_en='Edited name',short_description_ar='وصف',details_ar='تفاصيل',short_description_en='',details_en='' WHERE id=1");
 const originalFetch=global.fetch,previous=process.env.TRANSLATION_URL,calls=[];process.env.TRANSLATION_URL='http://127.0.0.1:8765';
 global.fetch=async(url,options)=>{const {q}=JSON.parse(options.body);calls.push(q);return {ok:true,json:async()=>({translatedText:q==='وصف'?'Short description':'Full description'})}};
 try{const run=await request(app).post('/api/manage/translations/run').set(admin).send({});assert.equal(run.status,200,JSON.stringify(run.body));assert.equal(run.body.updated,1);assert.deepEqual(calls,['وصف','تفاصيل']);const p=(await fixture.db.query('SELECT * FROM products WHERE id=1')).rows[0];assert.equal(p.name_en,'Edited name');assert.equal(p.short_description_en,'Short description');assert.equal(p.details_en,'Full description');assert.equal((await request(app).post('/api/manage/translations/run').set(admin).send({})).body.updated,0)}finally{global.fetch=originalFetch;if(previous===undefined)delete process.env.TRANSLATION_URL;else process.env.TRANSLATION_URL=previous}
});
test('translation completion cannot overwrite an edit made while the provider is running',async()=>{
 await fixture.db.query("UPDATE products SET translation_status='MACHINE',details_en='' WHERE id=1");
 const originalFetch=global.fetch,previous=process.env.TRANSLATION_URL;process.env.TRANSLATION_URL='http://127.0.0.1:8765';
 global.fetch=async()=>{await fixture.db.query("UPDATE products SET details_en='Editor correction',translation_status='REVIEWED' WHERE id=1");return {ok:true,json:async()=>({translatedText:'Machine result'})}};
 try{const run=await request(app).post('/api/manage/translations/run').set(admin).send({});assert.equal(run.body.updated,0);assert.equal((await fixture.db.query('SELECT details_en FROM products WHERE id=1')).rows[0].details_en,'Editor correction')}finally{global.fetch=originalFetch;if(previous===undefined)delete process.env.TRANSLATION_URL;else process.env.TRANSLATION_URL=previous}
});
