// Read-only post-deployment checks. Never creates accounts, orders or payments.
const fs=require('node:fs'),assert=require('node:assert/strict');
const origin=process.argv.find(a=>a.startsWith('--origin='))?.slice(9)||'http://127.0.0.1:3101';
if(!['http://127.0.0.1:3101','https://mikyajkw.com','https://mikyaj-backend.onrender.com'].includes(origin))throw Error('Unknown release destination');
const expected=require('../backend/services/asset-version');
async function get(route){const r=await fetch(origin+route,{signal:AbortSignal.timeout(30000)});return r}
(async()=>{
 const health=await get('/api/health');assert.equal(health.status,200);const state=await health.json();assert.equal(state.assets,expected,'Backend is not running the expected asset release');
 const home=await get('/en/'),html=await home.text();assert.equal(home.status,200);assert.ok(html.includes('v='+expected),'Frontend is not running the expected release');
 const images=require('../docs/taxonomy-artwork.json');let count=0;for(let i=0;i<images.length;i+=8)await Promise.all(images.slice(i,i+8).map(async e=>{const r=await get('/assets/images/taxonomy/'+e.file);assert.equal(r.status,200,e.file);assert.match(r.headers.get('content-type'),/image\/webp/);count++}));
 const removals=require('../docs/skinlite-removal-review.json');for(const p of removals){const r=await get('/api/products/'+p.slug);assert.equal(r.status,404,p.slug+' must be removed');}
 const catalog=await(await get('/api/products?limit=1')).json();assert.ok(catalog.products.length);const slug=catalog.products[0].slug;
 for(const lang of ['en','ar']){const page=await get('/'+lang+'/products/'+slug),text=await page.text();assert.equal(page.status,200);assert.ok(text.includes(lang==='en'?'How to use':'طريقة الاستخدام'));assert.ok(text.includes('dir="ltr"'));}
 const admin=await get('/admin/manage.html'),adminHtml=await admin.text();assert.equal(admin.status,200);assert.ok(adminHtml.includes('v='+expected));
 const bundle=await(await get('/js/admin-store.js?v='+expected)).text();assert.ok(bundle.includes('admin-refresh'),'Refresh control absent from deployed bundle');
 const report={origin,checked_at:new Date().toISOString(),assets:expected,release:state.release,images:count,removed:removals.length,passed:true};fs.mkdirSync('.local-test-data',{recursive:true});fs.writeFileSync('.local-test-data/live-release-check.json',JSON.stringify(report,null,2));console.log(report);
})().catch(e=>{console.error('Release verification failed:',e.message);process.exitCode=1});
