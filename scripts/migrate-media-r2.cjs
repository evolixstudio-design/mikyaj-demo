// Image-only migration. Private backups and manifests stay outside Git/frontend assets.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
require('dotenv').config({quiet:true});
const media=require('../backend/services/media-storage');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const root=path.resolve(__dirname,'../.local-test-data/cloudinary-r2-migration-2026-10-29');
const targets={product_images:'cloudinary_url',categories:'image_url',brands:'image_url',product_variants:'image_url',blog_posts:'image_url',media_assets:'url'};
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const lines=name=>fs.existsSync(path.join(root,name))?fs.readFileSync(path.join(root,name),'utf8').split('\n').filter(Boolean).map(JSON.parse):[];
const write=(name,value)=>fs.writeFileSync(path.join(root,name),JSON.stringify(value,null,2));
async function publicCheck(saved,base){
  for(const object of saved.objects){
    const response=await fetch(base+'/'+object.key,{redirect:'error',signal:AbortSignal.timeout(30000)});
    if(!response.ok||!response.headers.get('content-type')?.startsWith('image/'))throw Error('Public image is not available: '+object.key);
    const buffer=Buffer.from(await response.arrayBuffer());
    if(buffer.length!==object.bytes||hash(buffer)!==object.sha256)throw Error('Public image checksum mismatch: '+object.key);
  }
}
async function upload(){
  const storage=media.config(),inventory=read('referenced-media-inventory.json');
  const backup=read('backup-result.json');
  if(!backup.all_referenced_images_backed_up)throw Error('Complete the image backup before uploading.');
  const originals=new Map(lines('backup-checksums.jsonl').map(v=>[v.url,v]));
  const completed=new Map(lines('r2-uploads.jsonl').map(v=>[v.source_url,v]));
  let cursor=0,count=0,totalBytes=[...completed.values()].reduce((n,v)=>n+v.bytes,0);
  async function worker(){while(cursor<inventory.urls.length){const url=inventory.urls[cursor++];
    const previous=completed.get(url);
    if(previous){if(!previous.url.startsWith(storage.base+'/'))throw Error('The previous upload used a different domain.');await publicCheck(previous,storage.base);count++;continue;}
    const original=originals.get(url);if(!original||path.basename(original.file)!==original.file)throw Error('Missing safe backup filename.');
    const buffer=fs.readFileSync(path.join(root,'originals',original.file));if(hash(buffer)!==original.sha256)throw Error('Backup checksum mismatch.');
    // Hard ceiling protects the free storage allowance; never remove or replace old images.
    if(totalBytes>8*1024**3)throw Error('Migration storage budget exceeded; inspect usage before proceeding.');
    const saved=await media.uploadImage(buffer,{id:original.key,purpose:'migration',storage});totalBytes+=saved.bytes;
    await publicCheck(saved,storage.base);
    const record={source_url:url,...saved,verified_at:new Date().toISOString()};
    fs.appendFileSync(path.join(root,'r2-uploads.jsonl'),JSON.stringify(record)+'\n');completed.set(url,record);count++;
    if(count%100===0)console.log(JSON.stringify({uploaded:count,total:inventory.urls.length,bytes:totalBytes}));
  }}
  await Promise.all([worker(),worker()]);
  write('r2-upload-result.json',{completed_at:new Date().toISOString(),count,bytes:totalBytes,base:storage.base,complete:count===inventory.urls.length});
  console.log(JSON.stringify({uploaded:count,bytes:totalBytes,production_urls_changed:false}));
}
async function apply(rollback=false){
  const inventory=read('referenced-media-inventory.json'),result=read('r2-upload-result.json');
  if(!result.complete)throw Error('All images must be publicly verified before changing any database URL.');
  if(!rollback&&media.publicBase()!==result.base)throw Error('The verified image domain does not match the configured production domain.');
  const uploads=new Map(lines('r2-uploads.jsonl').map(v=>[v.source_url,v]));
  if(inventory.urls.some(url=>!uploads.has(url)))throw Error('Migration manifest is incomplete.');
  const db=require('../backend/db'),client=await db.pool.connect();let changed=0,skipped=0;
  try{await client.query('BEGIN');await client.query("SELECT pg_advisory_xact_lock(79821340)");
    for(const record of inventory.records){
      const replacement=uploads.get(record.url).url;
      const old=rollback?replacement:record.url,next=rollback?record.url:replacement;
      let r;
      if(record.table==='store_settings'&&record.column==='value'&&typeof record.key==='string'&&Array.isArray(record.json_path)){
        r=await client.query('UPDATE store_settings SET value=jsonb_set(value,$1::text[],to_jsonb($2::text),false),updated_at=NOW() WHERE key=$3 AND value #>> $1::text[]=$4 RETURNING key',[record.json_path.map(String),next,record.key,old]);
      }else{
        if(targets[record.table]!==record.column||!record.id)throw Error('Unexpected migration table or column.');
        r=await client.query(`UPDATE ${record.table} SET ${record.column}=$1 WHERE id=$2 AND ${record.column}=$3 RETURNING id`,[next,record.id,old]);
      }
      if(r.rows.length)changed++;else skipped++;
    }
    await client.query('COMMIT');write(rollback?'rollback-result.json':'database-switch-result.json',{completed_at:new Date().toISOString(),changed,skipped,cloudinary_assets_deleted:false});
    console.log(JSON.stringify({changed,skipped,rollback}));
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();await db.pool.end();}
}
const mode=process.argv[2];
if(!['upload','apply','rollback'].includes(mode)){console.error('Usage: node scripts/migrate-media-r2.cjs upload|apply|rollback');process.exitCode=1;}
else (mode==='upload'?upload():apply(mode==='rollback')).catch(e=>{console.error('Migration stopped:',e.message);process.exitCode=1;});
