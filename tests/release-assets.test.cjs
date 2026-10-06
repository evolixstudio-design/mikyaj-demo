const {test}=require('node:test'),assert=require('node:assert/strict'),request=require('supertest');
test('built pages and assets revalidate, support Brotli and expose safe release identifiers',async()=>{
 const fixture=await require('./isolated-db.cjs').setup();process.env.SERVE_DIST='1';
 try{const app=require('../backend/app').createApp();const page=await request(app).get('/en/');assert.equal(page.status,200);assert.match(page.text,/storefront\.js\?v=[a-f0-9]{16}/);assert.match(page.headers['cache-control'],/must-revalidate/);
 const js=await request(app).get('/js/storefront.js').set('Accept-Encoding','br');assert.equal(js.status,200);assert.equal(js.headers['content-encoding'],'br');assert.match(js.headers['cache-control'],/must-revalidate/);
 const api=await request(app).get('/api/manage/products');assert.equal(api.headers['cache-control'],'no-store');const health=await request(app).get('/api/health');assert.match(health.body.assets,/^[a-f0-9]{16}$/);
 const product=await request(app).get('/en/products/rose-lipstick');assert.match(product.text,/How to use/);assert.match(product.text,/Product-specific directions have not yet been provided/);
 }finally{delete process.env.SERVE_DIST;await fixture.close()}
});
