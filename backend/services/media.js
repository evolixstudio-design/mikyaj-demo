const sharp = require('sharp');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs/promises');
const db = require('../db');
const error = (message, status=400) => Object.assign(new Error(message), {status});
const previewDirectory = path.resolve(__dirname, '../../.local-test-data/media');
function validateUrl(value) {
  if (!value) return null;
  if (/^\/assets\/images\/taxonomy\/(?:category|brand)-[a-z0-9-]+\.webp$/.test(value) && require('node:fs').existsSync(path.resolve(__dirname,'../../frontend/mikyaj-demo'+value))) return value;
  if (process.env.NODE_ENV === 'test' && /^\/__preview\/media\/[a-f0-9-]{36}\.webp$/.test(value)) return value;
  let url; try { url=new URL(value); } catch { throw error('Upload an image or use a valid Cloudinary HTTPS image URL.'); }
  if (url.protocol!=='https:' || url.hostname!=='res.cloudinary.com') throw error('Use an uploaded image or a Cloudinary HTTPS image URL.');
  return url.href;
}
async function processImage(data, purpose='product') {
  if (!['product','category','brand','content'].includes(purpose)) throw error('Invalid image purpose.');
  if (typeof data!=='string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data)) throw error('Choose a JPEG, PNG or WebP image.');
  const original=Buffer.from(data.split(',')[1],'base64');
  if (!original.length || original.length>4*1024*1024) throw error('Images must be smaller than 4 MB.');
  let metadata, buffer;
  try {
    metadata=await sharp(original,{limitInputPixels:40000000,animated:false}).metadata();
    if (!['jpeg','png','webp'].includes(metadata.format) || (metadata.pages||1)>1) throw Error();
    buffer=await sharp(original,{limitInputPixels:40000000}).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:84}).toBuffer();
  } catch { throw error('This image could not be decoded. Choose a valid, non-animated image under 40 megapixels.'); }
  const output=await sharp(buffer).metadata();
  if (purpose==='product' && output.width>=120 && output.height>=120) {
    const width=Math.max(40,Math.round(output.width*.18));
    const logo=await sharp(path.resolve(__dirname,'../../frontend/mikyaj-demo/favicon-192.png')).resize({width}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    for(let i=3;i<logo.data.length;i+=4) logo.data[i]=Math.round(logo.data[i]*.30);
    const watermark=await sharp(logo.data,{raw:logo.info}).png().toBuffer();
    buffer=await sharp(buffer).composite([{input:watermark,gravity:'southeast'}]).webp({quality:84}).toBuffer();
  }
  return {buffer,original,width:output.width,height:output.height,format:metadata.format};
}
async function upload(data,purpose,adminId) {
  const image=await processImage(data,purpose),id=crypto.randomUUID();
  let url,originalReference;
  if (process.env.NODE_ENV==='test') {
    await fs.mkdir(previewDirectory,{recursive:true});
    await fs.writeFile(path.join(previewDirectory,id+'.webp'),image.buffer);
    url='/__preview/media/'+id+'.webp';
  } else {
    if(!process.env.CLOUDINARY_API_SECRET) throw error('Image storage is not configured. Set the Cloudinary credentials before uploading.',503);
    const cloud=require('cloudinary').v2;
    cloud.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,api_secret:process.env.CLOUDINARY_API_SECRET,secure:true});
    const uploaded=await cloud.uploader.upload('data:image/webp;base64,'+image.buffer.toString('base64'),{folder:'mikyaj/'+purpose,public_id:id,resource_type:'image'});
    url=uploaded.secure_url;
    // Original uploads are intentionally not publicly exposed.
    originalReference=null;
  }
  await db.query('INSERT INTO media_assets(id,url,original_reference,purpose,width,height,bytes,admin_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,url,originalReference,purpose,image.width,image.height,image.buffer.length,adminId]);
  return {url,width:image.width,height:image.height,bytes:image.buffer.length};
}
module.exports={upload,processImage,validateUrl,previewDirectory};
