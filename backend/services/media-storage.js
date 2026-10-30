const crypto = require('node:crypto');
const sharp = require('sharp');
const {S3Client, PutObjectCommand, HeadObjectCommand} = require('@aws-sdk/client-s3');
const widths = [240, 480, 800];
const fail = message => Object.assign(new Error(message), {status:503});

function publicBase() {
  if (!process.env.MEDIA_PUBLIC_BASE_URL) return null;
  const url = new URL(process.env.MEDIA_PUBLIC_BASE_URL);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw fail('Configure a public HTTPS image domain without a path.');
  return url.origin;
}
function config() {
  const account = process.env.R2_ACCOUNT_ID;
  if (!/^[a-f0-9]{32}$/i.test(account || '') || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(process.env.R2_BUCKET || '') || !publicBase()) throw fail('R2 image storage is not configured.');
  return {bucket:process.env.R2_BUCKET, base:publicBase(), client:new S3Client({region:'auto',endpoint:`https://${account}.r2.cloudflarestorage.com`,credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY},requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED'})};
}
async function prepareImages(buffer) {
  const master = await sharp(buffer,{limitInputPixels:40000000,animated:false}).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:90,effort:5}).toBuffer();
  const metadata = await sharp(master).metadata();
  const files = [{suffix:'',buffer:master,width:metadata.width,height:metadata.height}];
  for (const width of widths) {
    const body = await sharp(master).resize({width,withoutEnlargement:true}).webp({quality:86,effort:5}).toBuffer();
    files.push({suffix:`-w${width}`,buffer:body});
  }
  return files;
}
async function uploadImage(buffer, {id=crypto.randomUUID(),purpose='product',storage}={}) {
  if (!/^[a-z0-9-]{1,80}$/.test(id) || !['product','category','brand','content','migration'].includes(purpose)) throw fail('Invalid image storage key.');
  const target = storage || config();
  const files = await prepareImages(buffer), prefix = `mikyaj/v1/${purpose}/${id}/image`;
  const objects=[];
  for (const file of files) {
    const key = prefix + file.suffix + '.webp', hash = crypto.createHash('sha256').update(file.buffer).digest('hex');
    await target.client.send(new PutObjectCommand({Bucket:target.bucket,Key:key,Body:file.buffer,ContentType:'image/webp',CacheControl:'public, max-age=31536000, immutable',Metadata:{sha256:hash}}));
    const saved = await target.client.send(new HeadObjectCommand({Bucket:target.bucket,Key:key}));
    if (Number(saved.ContentLength) !== file.buffer.length || saved.Metadata?.sha256 !== hash) throw fail('Uploaded image verification failed; the existing image has been retained.');
    objects.push({key,sha256:hash,bytes:file.buffer.length});
  }
  return {url:target.base+'/'+prefix+'.webp',width:files[0].width,height:files[0].height,bytes:files.reduce((n,f)=>n+f.buffer.length,0),objects};
}
function imageUrl(source,width=480) {
  if (!source) return source;
  let url; try {url=new URL(source);} catch {return source;}
  if (url.protocol !== 'https:') return source;
  if (url.hostname === 'res.cloudinary.com') return source.replace('/image/upload/',`/image/upload/f_auto,q_auto,c_limit,w_${width}/`);
  if (url.origin === publicBase() && widths.includes(Number(width)) && /^\/mikyaj\/v1\/(?:product|category|brand|content|migration)\/[a-z0-9-]+\/image\.webp$/.test(url.pathname)) {
    url.pathname=url.pathname.replace('/image.webp',`/image-w${width}.webp`); return url.href;
  }
  return source;
}
module.exports={publicBase,config,prepareImages,uploadImage,imageUrl,widths};
