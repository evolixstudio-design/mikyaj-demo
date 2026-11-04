const db=require('../db');
const {getSettings}=require('./commerce-settings');
const {fail}=require('./commerce-quote');

async function config(connection=db){
 const saved=await getSettings('listing_billing',connection);
 const sources=Array.isArray(saved.billable_sources)?saved.billable_sources.filter(s=>['ADMIN','SUPPLIER_IMPORT','OTHER'].includes(s)):['ADMIN','SUPPLIER_IMPORT','OTHER'];
 return {currency:'INR',rate_paise:Number.isSafeInteger(saved.rate_paise)&&saved.rate_paise>=0?saved.rate_paise:1100,billable_sources:sources,initial_catalogue_excluded:true};
}

// Billing dates follow the shop's calendar (Kuwait, UTC+03:00).
const DAY=86400000,KUWAIT_OFFSET=3*3600000;
function billingWindow(query={},now=new Date()){
 const period=query.period||(query.from||query.to?'custom':'all');
 if(!['all','7d','14d','1m','3m','this-month','last-month','custom'].includes(period))fail('Choose a valid billing period.');
 const today=new Date(now.getTime()+KUWAIT_OFFSET).toISOString().slice(0,10);
 const date=value=>{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))fail('Enter dates in YYYY-MM-DD format.');
  const result=new Date(value+'T00:00:00Z');
  if(!Number.isFinite(result.getTime())||result.toISOString().slice(0,10)!==value)fail('Enter a valid calendar date.');
  return result;
 };
 const iso=d=>d.toISOString().slice(0,10);
 const shiftMonth=(value,months)=>{
  const original=date(value),day=original.getUTCDate();original.setUTCDate(1);original.setUTCMonth(original.getUTCMonth()+months);
  const end=new Date(Date.UTC(original.getUTCFullYear(),original.getUTCMonth()+1,0)).getUTCDate();original.setUTCDate(Math.min(day,end));return iso(original);
 };
 if(period==='all'){
  if(query.from||query.to)fail('Choose Custom dates to filter a date range.');
  return {period,from:null,to:null,start:null,end:null,time_zone:'Asia/Kuwait'};
 }
 let from,to=today;
 if(period==='custom'){
  date(query.from);date(query.to);from=query.from;to=query.to;
 }else{
  if(query.from||query.to)fail('Choose Custom dates to filter a date range.');
  if(period==='7d'||period==='14d')from=iso(new Date(date(today).getTime()-(period==='7d'?6:13)*DAY));
  if(period==='1m'||period==='3m')from=shiftMonth(today,period==='1m'?-1:-3);
  if(period==='this-month')from=today.slice(0,8)+'01';
  if(period==='last-month'){from=shiftMonth(today.slice(0,8)+'01',-1);to=iso(new Date(date(today.slice(0,8)+'01').getTime()-DAY));}
 }
 if(from>to)fail('The start date must be on or before the end date.');
 return {period,from,to,start:new Date(date(from).getTime()-KUWAIT_OFFSET).toISOString(),end:new Date(date(to).getTime()+DAY-KUWAIT_OFFSET).toISOString(),time_zone:'Asia/Kuwait'};
}

async function report(query={},connection=db){
 const settings=await config(connection);
 const window=billingWindow(query);
 const limit=query.limit===undefined?50:Number(query.limit),offset=query.offset===undefined?0:Number(query.offset);
 if(!Number.isSafeInteger(limit)||limit<1||limit>500||!Number.isSafeInteger(offset)||offset<0||offset>1000000)fail('Invalid listing pagination.');
 const aggregate=`SELECT COUNT(*)::int AS tracked_listings,
 COUNT(*) FILTER(WHERE source='ADMIN')::int AS admin_created,
 COUNT(*) FILTER(WHERE source='SUPPLIER_IMPORT')::int AS imported_new,
 COUNT(*) FILTER(WHERE source='OTHER')::int AS other_new,
 COUNT(*) FILTER(WHERE source=ANY($1::text[]))::int AS billable_listings,
 COALESCE(SUM(rate_paise) FILTER(WHERE source=ANY($1::text[])),0)::bigint AS amount_paise
 FROM product_listing_ledger`;
 const allTime=(await connection.query(aggregate,[settings.billable_sources])).rows[0];
 const parameters=[settings.billable_sources],where=window.start?' WHERE listed_at >= $2::timestamptz AND listed_at < $3::timestamptz':'';
 if(window.start)parameters.push(window.start,window.end);
 const totals=window.start?(await connection.query(aggregate+where,parameters)).rows[0]:allTime;
 const rows=(await connection.query(`SELECT l.id,l.product_reference,l.name_en,l.name_ar,l.source,l.listed_at,l.rate_paise,
 (l.source=ANY($1::text[])) AS billable,p.slug,p.status,p.deleted_at,
 COALESCE(NULLIF(p.name_en,''),l.name_en) AS current_name_en,
 COALESCE(NULLIF(p.name_ar,''),l.name_ar) AS current_name_ar
 FROM product_listing_ledger l LEFT JOIN products p ON p.id=l.product_id
 ${window.start?'WHERE l.listed_at >= $2::timestamptz AND l.listed_at < $3::timestamptz':''}
 ORDER BY l.listed_at DESC,l.id DESC LIMIT $${parameters.length+1} OFFSET $${parameters.length+2}`,[...parameters,limit,offset])).rows;
 return {settings,window,summary:{...totals,amount_paise:Number(totals.amount_paise)},all_time_summary:{...allTime,amount_paise:Number(allTime.amount_paise)},rows,offset,limit,next_offset:offset+rows.length<totals.tracked_listings?offset+rows.length:null};
}

module.exports={config,report,billingWindow};
