const {test}=require('node:test');
const assert=require('node:assert/strict');
const sharp=require('sharp');
const storage=require('../backend/services/media-storage');

test('R2 uploads verify every immutable size, preserve ratio and never enlarge small originals',async()=>{
  const photo=await sharp({create:{width:1000,height:600,channels:3,background:'#dcc1b2'}}).png().toBuffer();
  const objects=new Map(),fake={bucket:'test-media',base:'https://images.example.test',client:{send:async command=>{
    const i=command.input;
    if(command.constructor.name==='PutObjectCommand'){objects.set(i.Key,i);return {};}
    const saved=objects.get(i.Key);return {ContentLength:saved.Body.length,Metadata:saved.Metadata};
  }}};
  const result=await storage.uploadImage(photo,{id:'example-photo',storage:fake});
  assert.equal(result.url,'https://images.example.test/mikyaj/v1/product/example-photo/image.webp');
  assert.equal(objects.size,4);assert.equal(result.width,1000);assert.equal(result.height,600);
  for(const [key,file]of objects){assert.equal(file.ContentType,'image/webp');assert.match(file.CacheControl,/immutable/);const m=await sharp(file.Body).metadata();const expected=/w(\d+)/.exec(key);assert.equal(m.width,expected?Number(expected[1]):1000);assert.equal(m.height/m.width,.6);}
  const tiny=await sharp({create:{width:60,height:40,channels:3,background:'#ffffff'}}).png().toBuffer();
  for(const file of await storage.prepareImages(tiny))assert.equal((await sharp(file.buffer).metadata()).width,60);
});
test('a corrupt or incomplete upload fails before a new image URL is returned',async()=>{
  const photo=await sharp({create:{width:20,height:20,channels:3,background:'#fff'}}).png().toBuffer();
  await assert.rejects(storage.uploadImage(photo,{storage:{bucket:'test',base:'https://images.example.test',client:{send:async()=>({ContentLength:0,Metadata:{}})}}}),/verification failed/);
});
test('only configured HTTPS image storage is accepted and both providers keep responsive URLs',()=>{
  const previous=process.env.MEDIA_PUBLIC_BASE_URL;process.env.MEDIA_PUBLIC_BASE_URL='https://images.mikyajkw.com';
  try{
    const source='https://images.mikyajkw.com/mikyaj/v1/migration/abc123/image.webp';
    assert.equal(storage.imageUrl(source,480),source.replace('image.webp','image-w480.webp'));
    assert.equal(storage.imageUrl(source,1600),source);
    assert.equal(storage.imageUrl('https://other.example/mikyaj/v1/migration/abc123/image.webp',480),'https://other.example/mikyaj/v1/migration/abc123/image.webp');
    assert.match(storage.imageUrl('https://res.cloudinary.com/test/image/upload/v1/photo.jpg',240),/upload\/f_auto,q_auto,c_limit,w_240\//);
    const media=require('../backend/services/media');
    assert.equal(media.validateUrl(source),source);
    for(const url of ['http://images.mikyajkw.com/x','https://images.mikyajkw.com.evil.test/x','https://user:pass@images.mikyajkw.com/x','file:///x','javascript:alert(1)'])assert.throws(()=>media.validateUrl(url));
  }finally{if(previous===undefined)delete process.env.MEDIA_PUBLIC_BASE_URL;else process.env.MEDIA_PUBLIC_BASE_URL=previous;}
});
test('storefront cards use the prebuilt R2 sizes without requesting Cloudinary transforms',()=>{
  const fs=require('node:fs'),vm=require('node:vm');
  const source=fs.readFileSync(require.resolve('../frontend/mikyaj-demo/js/ui.js'),'utf8').split('\n').filter(l=>l.startsWith('export function imageUrl(')||l.startsWith('export function imageTag(')).join('\n').replaceAll('export function ','function ');
  const context={URL,location:{origin:'https://mikyajkw.com'},lang:'en',esc:v=>String(v),name:p=>p.name_en};vm.createContext(context);vm.runInContext(source,context);
  const url='https://images.mikyajkw.com/mikyaj/v1/product/abc123/image.webp';
  const html=context.imageTag({name_en:'Cleanser',primary_image:{url,alt_en:'Cleanser bottle'}});
  assert.match(html,/image-w240.webp 240w/);assert.match(html,/image-w480.webp 480w/);assert.match(html,/image-w800.webp 800w/);assert.doesNotMatch(html,/cloudinary/);
  assert.match(context.imageTag({name_en:'Local',primary_image:{url:'/assets/images/placeholder.svg'}}),/src="https:\/\/mikyajkw.com\/assets/);
});
