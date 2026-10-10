const db=require('../db');
const OFFER_JOIN=`LEFT JOIN LATERAL (
 SELECT id,title_en,title_ar,discount_percent FROM offers
 WHERE active AND starts_at<=NOW() AND (ends_at IS NULL OR ends_at>NOW())
 AND (product_id=p.id OR (product_id IS NULL AND category_id=p.category_id))
 ORDER BY priority DESC,discount_percent DESC,id DESC LIMIT 1
) offer ON true`;
const PRICE=`ROUND(p.selling_price*(1-COALESCE(offer.discount_percent,0)/100),3)`;
const SELECT=`SELECT p.id,p.sku,p.slug,p.name_ar,p.name_en,p.variants_enabled,(p.variants_enabled AND EXISTS(SELECT 1 FROM product_variants v WHERE v.product_id=p.id AND v.status='ACTIVE')) AS has_shades,p.short_description_ar,p.short_description_en,
 p.details_ar,p.details_en,p.how_to_use_ar,p.how_to_use_en,p.custom_fields,p.status,p.stock_status,p.priority,p.routine_step,p.translation_status,
 p.seo_title_ar,p.seo_title_en,p.seo_description_ar,p.seo_description_en,
 p.selling_price AS base_price,${PRICE} AS selling_price,
 CASE WHEN offer.id IS NOT NULL THEN GREATEST(COALESCE(p.regular_price,0),p.selling_price) ELSE p.regular_price END AS regular_price,
 p.currency,p.category_id,p.brand_id,p.updated_at,p.created_at,p.inventory_quantity,p.low_stock_threshold,
 json_build_object('id',c.id,'slug',c.slug,'name_ar',c.name_ar,'name_en',c.name_en,'priority',c.priority) AS category,
 CASE WHEN b.id IS NULL THEN NULL ELSE json_build_object('id',b.id,'name',b.name,'slug',b.slug,'image_url',b.image_url) END AS brand,
 CASE WHEN offer.id IS NULL THEN NULL ELSE json_build_object('id',offer.id,'title_en',offer.title_en,'title_ar',offer.title_ar,'discount_percent',offer.discount_percent) END AS offer,
 (SELECT json_build_object('url',pi.cloudinary_url,'width',pi.width,'height',pi.height,'alt_ar',pi.alt_ar,'alt_en',pi.alt_en) FROM product_images pi WHERE pi.product_id=p.id AND pi.cloudinary_url IS NOT NULL ORDER BY image_order,id LIMIT 1) AS primary_image
 FROM products p JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand_id ${OFFER_JOIN}`;
// Product grids do not need full descriptions or private custom fields from the database.
const GRID_SELECT=SELECT.replace('p.short_description_ar,p.short_description_en,','').replace('p.details_ar,p.details_en,p.how_to_use_ar,p.how_to_use_en,p.custom_fields,','').replace('p.seo_title_ar,p.seo_title_en,p.seo_description_ar,p.seo_description_en,','');
const VISIBLE="p.deleted_at IS NULL AND p.status='ACTIVE' AND c.status='ACTIVE'";
const SORT={featured:'c.priority DESC,p.priority DESC,p.id DESC',newest:'p.id DESC',oldest:'p.id ASC','name-desc':"COALESCE(NULLIF(p.name_en,''),p.name_ar) DESC,p.id DESC",'quantity-asc':'p.inventory_quantity ASC NULLS LAST,p.id DESC','quantity-desc':'p.inventory_quantity DESC NULLS LAST,p.id DESC','price-asc':`${PRICE} ASC,p.id DESC`,'price-desc':`${PRICE} DESC,p.id DESC`,name:"COALESCE(NULLIF(p.name_en,''),p.name_ar) ASC,p.id DESC"};
function summary(p){const {details_ar,details_en,how_to_use_ar,how_to_use_en,custom_fields,short_description_ar,short_description_en,seo_title_ar,seo_title_en,seo_description_ar,seo_description_en,...rest}=p;return rest;}
function boundedInteger(value,fallback,max){if(value===undefined)return fallback;const n=Number(value);if(!Number.isInteger(n)||n<0||n>max)throw Object.assign(new Error('Invalid pagination'),{status:400});return n;}
async function listProducts(q={},admin=false,connection=db){
 const limit=Math.max(1,boundedInteger(q.limit,24,60));
 let offset=boundedInteger(q.offset,0,100000);
 if(q.cursor){const decoded=Buffer.from(String(q.cursor),'base64url').toString();if(!/^offset:\d+$/.test(decoded))throw Object.assign(new Error('Invalid cursor'),{status:400});offset=boundedInteger(decoded.slice(7),0,100000);}
 const params=[],clauses=[admin?'p.deleted_at IS NULL':VISIBLE];const add=(sql,value)=>{params.push(value);clauses.push(sql.replace('?',`$${params.length}`));};
 if(q.search){params.push('%'+String(q.search).slice(0,150)+'%');const n=params.length;clauses.push(`(p.name_ar ILIKE $${n} OR p.name_en ILIKE $${n} OR p.sku ILIKE $${n} OR b.name ILIKE $${n} OR c.name_en ILIKE $${n} OR c.name_ar ILIKE $${n})`);}
 if(q.category)add('c.slug=?',q.category);
 if(q.brand)add('b.slug=?',q.brand);
 if(q.status&&admin)add('p.status=?',q.status);
 if(q.stock_status)add('p.stock_status=?',q.stock_status);
 for(const [key,op] of [['min_price','>='],['max_price','<=']]){if(q[key]!==undefined){const v=Number(q[key]);if(!Number.isFinite(v)||v<0)throw Object.assign(new Error('Invalid price range'),{status:400});add(`${PRICE}${op}?`,v);}}
 if(q.min_price!==undefined&&q.max_price!==undefined&&Number(q.min_price)>Number(q.max_price))throw Object.assign(new Error('Invalid price range'),{status:400});
 if(admin&&q.inventory==='low')clauses.push('p.inventory_quantity>0 AND p.inventory_quantity<=p.low_stock_threshold');
 if(admin&&q.inventory==='tracked')clauses.push('p.inventory_quantity IS NOT NULL');
 if(admin&&q.inventory==='untracked')clauses.push('p.inventory_quantity IS NULL');
 if(q.offers==='true')clauses.push('offer.id IS NOT NULL');
 const order=SORT[q.sort]||SORT.featured;params.push(limit+1,offset);
 const {rows}=await connection.query(`${admin?SELECT:GRID_SELECT} WHERE ${clauses.join(' AND ')} ORDER BY ${order} LIMIT $${params.length-1} OFFSET $${params.length}`,params);
 const total=admin?Number((await connection.query(`SELECT COUNT(*)::int AS count FROM products p JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand_id ${OFFER_JOIN} WHERE ${clauses.join(' AND ')}`,params.slice(0,-2))).rows[0].count):undefined;
 const more=rows.length>limit;return {total,products:rows.slice(0,limit).map(p=>admin?p:summary(p)),next_cursor:more?Buffer.from('offset:'+(offset+limit)).toString('base64url'):null};
}
async function product(slug,admin=false,connection=db){
 const {rows}=await connection.query(`${SELECT} WHERE ${admin?'p.deleted_at IS NULL':VISIBLE} AND p.slug=$1`,[slug]);
 if(!rows[0])return null;
 const images=await connection.query('SELECT cloudinary_url AS url,image_order AS "order",width,height,alt_ar,alt_en FROM product_images WHERE product_id=$1 AND cloudinary_url IS NOT NULL ORDER BY image_order,id',[rows[0].id]);
 const result={...rows[0],images:images.rows,content_sections:require('./product-content').contentSections(rows[0])};result.variants=admin||result.variants_enabled?(await connection.query("SELECT id,name_en,name_ar,color_hex,sku,image_url,stock_status,inventory_quantity,status,priority FROM product_variants WHERE product_id=$1 AND ($2::boolean OR status='ACTIVE') ORDER BY priority DESC,id",[result.id,admin])).rows:[];if(!admin){result.custom_field_display=await require('./product-fields').display(result.custom_fields);delete result.custom_fields;}return result;
}
async function byIds(ids,connection=db){if(!ids.length)return [];const products=(await connection.query(`${SELECT} WHERE ${VISIBLE} AND p.id=ANY($1::int[])`,[ids])).rows.map(({custom_fields,...p})=>p);const variants=(await connection.query("SELECT id,product_id,name_en,name_ar,color_hex,image_url,stock_status,inventory_quantity FROM product_variants WHERE product_id=ANY($1::int[]) AND status='ACTIVE'",[products.filter(p=>p.variants_enabled).map(p=>p.id)])).rows;return products.map(p=>({...p,variants:variants.filter(v=>v.product_id===p.id)}));}
async function recommendations(ids,customerId,limit=8){
 const safeIds=[...new Set(ids.map(Number).filter(n=>Number.isInteger(n)&&n>0))].slice(0,20);
 // Complementary routine steps first, then same category, followed by merchandised makeup.
 const seeds=await byIds(safeIds);let categories=seeds.map(p=>p.category_id);
 if(customerId){const {rows}=await db.query("SELECT DISTINCT p.category_id FROM orders o JOIN order_items oi ON oi.order_id=o.id JOIN products p ON p.id=oi.product_id WHERE o.customer_id=$1 AND o.status IN ('CONFIRMED','PROCESSING','READY_FOR_DELIVERY','OUT_FOR_DELIVERY','DELIVERED') LIMIT 12",[customerId]);categories.push(...rows.map(r=>r.category_id));}
 const pairs={cleanser:['toner','moisturizer','sunscreen'],toner:['serum','moisturizer'],serum:['moisturizer','sunscreen'],moisturizer:['cleanser','sunscreen'],foundation:['primer','concealer','setting'],lipstick:['lipliner'],mascara:['eyeliner'],sunscreen:['cleanser']};
 const steps=[...new Set(seeds.flatMap(p=>pairs[p.routine_step]||[]))];
 const {rows}=await db.query(`${GRID_SELECT} WHERE ${VISIBLE} AND p.stock_status='IN_STOCK' AND NOT(p.id=ANY($1::int[])) ORDER BY CASE WHEN p.routine_step=ANY($2::text[]) THEN 0 WHEN p.category_id=ANY($3::int[]) THEN 1 ELSE 2 END,c.priority DESC,p.priority DESC,p.id DESC LIMIT $4`,[safeIds,steps,categories,limit]);
 return rows.map(summary);
}
module.exports={listProducts,product,byIds,recommendations,SELECT,VISIBLE,PRICE};
