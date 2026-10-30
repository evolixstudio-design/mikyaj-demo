const {test}=require('node:test'),assert=require('node:assert/strict'),express=require('express'),request=require('supertest'),{Readable}=require('node:stream');
const {createMediaRouter}=require('../backend/routes/media-public');
const image=Buffer.from('test-processed-webp'),url='/mikyaj/v1/migration/'+'a'.repeat(64)+'/image-w480.webp';
function fixture({missing=false,invalid=false}={}){
 const calls=[],app=express();app.use('/mikyaj/v1',createMediaRouter({getStorage:()=>({bucket:'mikyaj-media',client:{send:async command=>{
   calls.push(command.input);if(missing)throw Object.assign(new Error('Missing'),{name:'NoSuchKey'});
   return {Body:command.constructor.name==='GetObjectCommand'?Readable.from([image]):undefined,ContentType:invalid?'text/html':'image/webp',ContentLength:image.length,ETag:'"image-version"'};
 }}})}));return {app,calls};
}
test('private R2 images are served as cacheable public images without cookies or credentials',async()=>{
 const {app,calls}=fixture();const response=await request(app).get(url).set('Cookie','irrelevant=1');assert.equal(response.status,200);assert.deepEqual(response.body,image);assert.equal(response.headers['content-type'],'image/webp');assert.match(response.headers['cache-control'],/31536000.*immutable/);assert.match(response.headers['netlify-cdn-cache-control'],/public.*31536000/);assert.equal(response.headers['set-cookie'],undefined);assert.equal(calls[0].Key,url.slice(1));assert.equal(calls[0].Bucket,'mikyaj-media');
 const head=await request(app).head(url);assert.equal(head.status,200);assert.equal(Number(head.headers['content-length']),image.length);assert.equal(head.text,undefined);
 assert.equal((await request(app).get(url).set('If-None-Match','"image-version"')).status,304);
});
test('public gateway cannot list buckets, fetch URLs, read private evidence or request arbitrary sizes',async()=>{
 const {app,calls}=fixture();for(const path of ['/mikyaj/v1/','/mikyaj/v1/evidence/abc/image.webp','/mikyaj/v1/migration/abc/image-w400.webp','/mikyaj/v1/migration/abc/original.jpg','/mikyaj/v1/https://example.test/image.webp','/mikyaj/v1/migration/%2e%2e%2fsecret/image.webp'])assert.equal((await request(app).get(path)).status,404,path);
 assert.equal((await request(app).post(url)).status,405);assert.equal(calls.length,0);
});
test('missing objects and unsafe content fail without caching errors',async()=>{
 for(const options of [{missing:true},{invalid:true}]){const {app}=fixture(options);const response=await request(app).get(url);assert.equal(response.status,options.missing?404:503);assert.equal(response.headers['cache-control'],'no-store');assert.equal(response.headers['netlify-cdn-cache-control'],undefined);assert.doesNotMatch(response.text,/Bucket|credential|secret/i);}
});
