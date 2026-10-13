const db=require('../db');
const {getSettings}=require('./commerce-settings');
const {fail}=require('./commerce-quote');

async function config(connection=db){
 const saved=await getSettings('listing_billing',connection);
 const sources=Array.isArray(saved.billable_sources)?saved.billable_sources.filter(s=>['ADMIN','SUPPLIER_IMPORT','OTHER'].includes(s)):['ADMIN','SUPPLIER_IMPORT','OTHER'];
 return {currency:'INR',rate_paise:Number.isSafeInteger(saved.rate_paise)&&saved.rate_paise>=0?saved.rate_paise:1100,billable_sources:sources,initial_catalogue_excluded:true};
}

async function report(query={},connection=db){
 const settings=await config(connection);
 const limit=query.limit===undefined?50:Number(query.limit),offset=query.offset===undefined?0:Number(query.offset);
 if(!Number.isSafeInteger(limit)||limit<1||limit>500||!Number.isSafeInteger(offset)||offset<0||offset>1000000)fail('Invalid listing pagination.');
 const totals=(await connection.query(`SELECT COUNT(*)::int AS tracked_listings,
 COUNT(*) FILTER(WHERE source='ADMIN')::int AS admin_created,
 COUNT(*) FILTER(WHERE source='SUPPLIER_IMPORT')::int AS imported_new,
 COUNT(*) FILTER(WHERE source='OTHER')::int AS other_new,
 COUNT(*) FILTER(WHERE source=ANY($1::text[]))::int AS billable_listings,
 COALESCE(SUM(rate_paise) FILTER(WHERE source=ANY($1::text[])),0)::bigint AS amount_paise
 FROM product_listing_ledger`,[settings.billable_sources])).rows[0];
 const rows=(await connection.query(`SELECT l.id,l.product_reference,l.name_en,l.name_ar,l.source,l.listed_at,l.rate_paise,
 (l.source=ANY($1::text[])) AS billable,p.slug,p.status,p.deleted_at,
 COALESCE(NULLIF(p.name_en,''),l.name_en) AS current_name_en,
 COALESCE(NULLIF(p.name_ar,''),l.name_ar) AS current_name_ar
 FROM product_listing_ledger l LEFT JOIN products p ON p.id=l.product_id
 ORDER BY l.listed_at DESC,l.id DESC LIMIT $2 OFFSET $3`,[settings.billable_sources,limit,offset])).rows;
 return {settings,summary:{...totals,amount_paise:Number(totals.amount_paise)},rows,offset,limit,next_offset:offset+rows.length<totals.tracked_listings?offset+rows.length:null};
}

module.exports={config,report};
