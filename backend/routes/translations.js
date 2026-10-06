const router=require('express').Router();const db=require('../db');const crypto=require('node:crypto');const {getSecret,audit}=require('../services/commerce-settings');const {fail}=require('../services/commerce-quote');
const sourceHash=p=>crypto.createHash('sha256').update(JSON.stringify([p.name_ar||'',p.short_description_ar||'',p.details_ar||''])).digest('hex');
router.get('/',async(req,res,next)=>{try{const {rows}=await db.query("SELECT translation_status,COUNT(*)::int AS count,COUNT(*) FILTER(WHERE (COALESCE(BTRIM(name_en),'')='' AND COALESCE(BTRIM(name_ar),'')<>'') OR (COALESCE(BTRIM(short_description_en),'')='' AND COALESCE(BTRIM(short_description_ar),'')<>'') OR (COALESCE(BTRIM(details_en),'')='' AND COALESCE(BTRIM(details_ar),'')<>''))::int AS incomplete FROM products WHERE deleted_at IS NULL GROUP BY translation_status");res.json({counts:rows,incomplete:rows.reduce((n,r)=>n+r.incomplete,0),offline_available:true,service_configured:Boolean(process.env.TRANSLATION_URL),google_configured:Boolean(await getSecret('GOOGLE_TRANSLATE_API_KEY'))});}catch(e){next(e)}});
router.get('/export',async(req,res,next)=>{try{const {rows}=await db.query("SELECT id,name_ar,short_description_ar,details_ar,name_en,short_description_en,details_en FROM products WHERE deleted_at IS NULL AND translation_status<>'REVIEWED' ORDER BY id");res.json(rows.map(p=>({...p,source_hash:sourceHash(p)})));}catch(e){next(e)}});
router.post('/import',async(req,res,next)=>{const client=await db.pool.connect();try{const records=req.body.products;if(!Array.isArray(records)||records.length>100)fail('Import at most 100 translations per batch.');await client.query('BEGIN');let updated=0,skipped=0;for(const p of records){if(!Number.isInteger(p.id)||typeof p.name_en!=='string'||!p.name_en.trim()||p.name_en.length>1000)fail('Invalid translation');const original=(await client.query('SELECT * FROM products WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[p.id])).rows[0];if(!original||original.translation_status==='REVIEWED'||p.source_hash!==sourceHash(original)){skipped++;continue;}for(const k of ['short_description_en','details_en'])if(typeof p[k]!=='string'||p[k].length>40000)fail('Invalid translated content');await client.query("UPDATE products SET name_en=$1,short_description_en=$2,details_en=$3,translation_status='MACHINE',translation_source_hash=$4,translation_error=NULL,updated_at=NOW() WHERE id=$5",[p.name_en,p.short_description_en,p.details_en,p.source_hash,p.id]);updated++;}await audit(req.admin.id,'translation.import','batch',{updated,skipped},client);await client.query('COMMIT');res.json({updated,skipped});}catch(e){await client.query('ROLLBACK');next(e)}finally{client.release()}});
// A translated name does not mean that descriptions are complete. Fill only missing
// English fields and use an optimistic guard to preserve concurrent editorial changes.
router.post('/run',async(req,res,next)=>{try{
 const {translate}=require('../services/translation');
 if(!process.env.TRANSLATION_URL&&!await getSecret('GOOGLE_TRANSLATE_API_KEY'))fail('Run the free offline translation tool, then import its file here. No paid account is required.',503);
 const {rows}=await db.query(`SELECT * FROM products WHERE deleted_at IS NULL AND translation_status<>'REVIEWED' AND (
  (COALESCE(BTRIM(name_en),'')='' AND COALESCE(BTRIM(name_ar),'')<>'') OR
  (COALESCE(BTRIM(short_description_en),'')='' AND COALESCE(BTRIM(short_description_ar),'')<>'') OR
  (COALESCE(BTRIM(details_en),'')='' AND COALESCE(BTRIM(details_ar),'')<>'')) ORDER BY id LIMIT 2`);
 let updated=0;
 for(const p of rows){
  const texts=[p.name_ar||'',p.short_description_ar||'',p.details_ar||''];
  const existing=[p.name_en||'',p.short_description_en||'',p.details_en||''],translations=[];
  for(let i=0;i<texts.length;i++)translations.push(existing[i].trim()?existing[i]:texts[i].trim()?await translate(texts[i],'ar','en'):existing[i]);
  const result=await db.query(`UPDATE products SET name_en=$1,short_description_en=$2,details_en=$3,translation_status='MACHINE',translation_source_hash=$4,translation_error=NULL,updated_at=NOW()
   WHERE id=$5 AND deleted_at IS NULL AND translation_status<>'REVIEWED'
   AND COALESCE(name_ar,'')=$6 AND COALESCE(short_description_ar,'')=$7 AND COALESCE(details_ar,'')=$8
   AND COALESCE(name_en,'')=$9 AND COALESCE(short_description_en,'')=$10 AND COALESCE(details_en,'')=$11 RETURNING id`,[...translations,sourceHash(p),p.id,...texts,...existing]);
  updated+=result.rows.length;
 }
 res.json({updated});
}catch(e){next(e)}});
module.exports=router;
