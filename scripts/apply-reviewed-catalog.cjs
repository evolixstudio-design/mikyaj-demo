// Explicit, guarded catalog transfer. No credentials, customers, orders or settings
// are copied from the test preview. Dry-run is the default; --apply commits.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=p=>crypto.createHash('sha256').update(JSON.stringify(['name_ar','short_description_ar','details_ar'].map(k=>p[k]||''))).digest('hex');
async function applyCatalog(client,release,{commit=false}={}){
 const result={translated:0,taxonomies:0,removed:0,skipped:[]};
 await client.query('BEGIN');
 try{
  await client.query('SELECT pg_advisory_xact_lock(20261006)');
  await client.query('CREATE TABLE IF NOT EXISTS catalog_release_backups(release_id TEXT NOT NULL,kind TEXT NOT NULL,record_id INTEGER NOT NULL,original JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(release_id,kind,record_id))');
  const products=(await client.query('SELECT * FROM products FOR UPDATE')).rows,bySlug=new Map(products.map(p=>[p.slug,p]));
  if(release.brands.length)await client.query(`INSERT INTO brands(name,name_en,name_ar,slug,search_aliases,status) SELECT COALESCE(NULLIF(r.name_en,''),r.name),r.name_en,r.name_ar,r.slug,r.search_aliases,'ACTIVE' FROM jsonb_to_recordset($1::jsonb) AS r(name text,name_en text,name_ar text,slug text,search_aliases text) ON CONFLICT(slug) DO NOTHING`,[JSON.stringify(release.brands)]);
  const accepted=[];
  for(const update of release.products){const p=bySlug.get(update.slug);if(!p||p.deleted_at||p.name_ar!==update.name_ar||p.translation_status==='REVIEWED'||![update.baseline_hash,update.source_hash].includes(hash(p))){result.skipped.push(update.slug);continue}accepted.push({...update,id:p.id});}
  if(accepted.length){
   const ids=accepted.map(p=>p.id);
   await client.query("INSERT INTO catalog_release_backups(release_id,kind,record_id,original) SELECT $1,'products',id,to_jsonb(p) FROM products p WHERE id=ANY($2::int[]) ON CONFLICT DO NOTHING",[release.id,ids]);
   await client.query(`UPDATE products p SET name_en=r.name_en,short_description_ar=r.short_description_ar,short_description_en=r.short_description_en,details_ar=r.details_ar,details_en=r.details_en,brand_id=COALESCE(p.brand_id,(SELECT id FROM brands WHERE slug=r.brand_slug)),translation_status='MACHINE',translation_source_hash=r.source_hash,updated_at=NOW()
    FROM jsonb_to_recordset($1::jsonb) AS r(id int,name_en text,short_description_ar text,short_description_en text,details_ar text,details_en text,source_hash text,brand_slug text) WHERE p.id=r.id`,[JSON.stringify(accepted)]);
   result.translated=accepted.length;
  }
  for(const kind of ['categories','brands']){
   const entries=release[kind];if(!entries.length)continue;
   await client.query(`INSERT INTO catalog_release_backups(release_id,kind,record_id,original) SELECT $1,$2,id,to_jsonb(p) FROM ${kind} p WHERE slug=ANY($3::text[]) ON CONFLICT DO NOTHING`,[release.id,kind,entries.map(e=>e.slug)]);
   const updated=await client.query(`UPDATE ${kind} p SET image_url=r.image_url,image_alt_en=r.image_alt_en,image_alt_ar=r.image_alt_ar,updated_at=NOW() FROM jsonb_to_recordset($1::jsonb) AS r(slug text,image_url text,image_alt_en text,image_alt_ar text) WHERE p.slug=r.slug RETURNING p.id`,[JSON.stringify(entries)]);result.taxonomies+=updated.rows.length;
  }
  const removed=[];for(const entry of release.removals){const p=bySlug.get(entry.slug);if(!p||p.name_ar!==entry.name_ar){result.skipped.push(entry.slug);continue}if(!p.deleted_at)removed.push(p.id);}
  if(removed.length){await client.query("INSERT INTO catalog_release_backups(release_id,kind,record_id,original) SELECT $1,'products',id,to_jsonb(p) FROM products p WHERE id=ANY($2::int[]) ON CONFLICT DO NOTHING",[release.id,removed]);await client.query("UPDATE products SET deleted_at=NOW(),status='INACTIVE',updated_at=NOW() WHERE id=ANY($1::int[])",[removed]);result.removed=removed.length;}
  await client.query(commit?'COMMIT':'ROLLBACK');return {...result,committed:commit};
 }catch(e){await client.query('ROLLBACK');throw e}
}
module.exports={applyCatalog,hash};
if(require.main===module){const file=process.argv.find(v=>v.startsWith('--file='))?.slice(7);if(!file)throw Error('Supply --file=<reviewed JSON release>. Default is dry-run; --apply commits.');require('dotenv').config({path:path.resolve(__dirname,'../.env'),quiet:true});const {pool}=require('../backend/db');(async()=>{const client=await pool.connect();try{console.log(JSON.stringify(await applyCatalog(client,JSON.parse(fs.readFileSync(file,'utf8')),{commit:process.argv.includes('--apply')})))}finally{client.release();await pool.end()}})().catch(e=>{console.error('Catalog transfer failed:',e.code||e.name);process.exitCode=1})}
