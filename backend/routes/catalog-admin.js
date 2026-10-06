const router=require('express').Router();
const crypto=require('node:crypto');
const db=require('../db');
const media=require('../services/media');
const {audit}=require('../services/commerce-settings');
const {fail}=require('../services/commerce-quote');
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
const text=(v,max=10000)=>String(v??'').trim().slice(0,max);
const id=v=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<1)fail('Invalid ID');return n};
const integer=(v,min=0,max=1000000)=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<min||n>max)fail('Invalid quantity or priority');return n};
const slugify=value=>require('slugify')(value,{lower:true,strict:true}).slice(0,150)||'item';
const newSlug=b=>b.slug?text(b.slug,180):slugify(b.name_en||b.name||b.name_ar)+'-'+crypto.randomBytes(3).toString('hex');
router.post('/images',require('../middleware/rate-limit')(30,60000),wrap(async(req,res)=>res.json(await media.upload(req.body.data,req.body.purpose||'product',req.admin.id))));
router.get('/product-views',wrap(async(req,res)=>res.json((await db.query('SELECT id,name,filters FROM admin_saved_views WHERE admin_id=$1 ORDER BY name',[req.admin.id])).rows)));
router.post('/product-views',wrap(async(req,res)=>{if(!text(req.body.name,100)||!req.body.filters||typeof req.body.filters!=='object')fail('A name and filters are required');const allowed=['search','category','brand','status','stock_status','inventory','sort','min_price','max_price'];const filters=Object.fromEntries(Object.entries(req.body.filters).filter(([k,v])=>allowed.includes(k)&&typeof v==='string'&&v.length<=150));res.json((await db.query('INSERT INTO admin_saved_views(admin_id,name,filters) VALUES($1,$2,$3) ON CONFLICT(admin_id,name) DO UPDATE SET filters=EXCLUDED.filters RETURNING *',[req.admin.id,text(req.body.name,100),filters])).rows[0])}));
router.delete('/product-views/:id',wrap(async(req,res)=>{await db.query('DELETE FROM admin_saved_views WHERE id=$1 AND admin_id=$2',[id(req.params.id),req.admin.id]);res.json({success:true})}));
router.post('/products/bulk',wrap(async(req,res)=>{
 const ids=[...new Set((Array.isArray(req.body.ids)?req.body.ids:[]).map(id))];if(!ids.length||ids.length>100)fail('Choose 1–100 products');
 const b=req.body,changes={publish:"status='ACTIVE'",unpublish:"status='INACTIVE'",archive:"status='ARCHIVED'",delete:"status='INACTIVE',deleted_at=NOW()",in_stock:"stock_status='IN_STOCK'",out_of_stock:"stock_status='OUT_OF_STOCK'",category:'category_id=$2',brand:'brand_id=$2',inventory:"inventory_quantity=$2,stock_status=CASE WHEN $2=0 THEN 'OUT_OF_STOCK' ELSE 'IN_STOCK' END"};
 if(!changes[b.action])fail('Unknown bulk action');
 const values=[ids];if(b.action==='category')values.push(id(b.value));if(b.action==='brand')values.push(b.value?id(b.value):null);if(b.action==='inventory')values.push(integer(b.value));
 const client=await db.pool.connect();try{await client.query('BEGIN');const result=await client.query(`UPDATE products SET ${changes[b.action]},updated_at=NOW() WHERE id=ANY($1::int[]) AND deleted_at IS NULL RETURNING id`,values);await audit(req.admin.id,'products.bulk.'+b.action,'batch',{ids:result.rows.map(r=>r.id),value:b.value},client);await client.query('COMMIT');res.json({updated:result.rows.length});}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}));
async function saveProduct(req,res){
 const b=req.body,productId=req.params.id?id(req.params.id):null;
 const nameAr=text(b.name_ar,500),nameEn=text(b.name_en,500);if(!nameAr&&!nameEn)fail('A product name is required.');
 const price=Number(b.selling_price);if(!Number.isFinite(price)||price<=0||price>999999)fail('Enter a positive price.');
 const regular=b.regular_price===''||b.regular_price==null?null:Number(b.regular_price);if(regular!==null&&(!Number.isFinite(regular)||regular<price||regular>999999))fail('The compare-at price must be at least the selling price.');
 const state=b.status||'INACTIVE';if(!['ACTIVE','INACTIVE','ARCHIVED'].includes(state))fail('Invalid visibility');
 const stock=b.stock_status||'IN_STOCK';if(!['IN_STOCK','OUT_OF_STOCK'].includes(stock))fail('Invalid availability');
 const inventory=b.inventory_quantity===''||b.inventory_quantity==null?null:integer(b.inventory_quantity);
 const images=Array.isArray(b.images)?b.images.map(i=>({url:media.validateUrl(i.url),alt_ar:text(i.alt_ar||nameAr,500),alt_en:text(i.alt_en||nameEn,500)})).filter(i=>i.url):[];
 if(!images.length||images.length>8)fail('Add between one and eight product images.');
 const productSlug=newSlug(b);if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(productSlug))fail('Invalid product URL');
 const customFields=b.custom_fields===undefined?undefined:await require('../services/product-fields').validate(b.custom_fields);
 const client=await db.pool.connect();let saved;
 try {await client.query('BEGIN');
 let categoryId=b.category_id?id(b.category_id):null;
 if(!categoryId)categoryId=(await client.query("INSERT INTO categories(name_ar,name_en,slug,priority) VALUES('غير مصنف','Uncategorized','uncategorized',-100) ON CONFLICT(slug) DO UPDATE SET slug=EXCLUDED.slug RETURNING id")).rows[0].id;
 const duplicate=await client.query('SELECT id FROM products WHERE slug=$1 AND ($2::int IS NULL OR id<>$2)',[productSlug,productId]);if(duplicate.rows.length)fail('This URL is already used',409);
 const fields={name_ar:nameAr,name_en:nameEn,short_description_ar:text(b.short_description_ar,40000),short_description_en:text(b.short_description_en,40000),details_ar:text(b.details_ar,40000),details_en:text(b.details_en,40000),slug:productSlug,sku:text(b.sku,100),category_id:categoryId,brand_id:b.brand_id?id(b.brand_id):null,selling_price:price.toFixed(3),regular_price:regular===null?null:regular.toFixed(3),status:state,stock_status:inventory===0?'OUT_OF_STOCK':stock,inventory_quantity:inventory,low_stock_threshold:integer(b.low_stock_threshold??5),priority:integer(b.priority||0,-100000,100000),routine_step:text(b.routine_step,50)||null};
 for(const language of ['ar','en'])if(b['how_to_use_'+language]!==undefined)fields['how_to_use_'+language]=text(b['how_to_use_'+language],40000);
 if(customFields!==undefined)fields.custom_fields=customFields;
 if(productId){const values=Object.values(fields);values.push(productId);saved=(await client.query(`UPDATE products SET ${Object.keys(fields).map((k,i)=>k+'=$'+(i+1)).join(',')},translation_status='REVIEWED',updated_at=NOW() WHERE id=$${values.length} AND deleted_at IS NULL RETURNING id`,values)).rows[0];if(!saved)fail('Product not found',404)}
 else {const source='manual:'+crypto.randomUUID();Object.assign(fields,{source_url:source,source_identity_hash:crypto.createHash('sha256').update(source).digest('hex'),source_price:price,currency:'KWD',translation_status:nameAr&&nameEn?'REVIEWED':'PENDING'});saved=(await client.query(`INSERT INTO products(${Object.keys(fields).join(',')}) VALUES(${Object.keys(fields).map((_,i)=>'$'+(i+1)).join(',')}) RETURNING id`,Object.values(fields))).rows[0]}
 await client.query('DELETE FROM product_images WHERE product_id=$1',[saved.id]);
 for(let i=0;i<images.length;i++){const image=images[i],asset=(await client.query('SELECT width,height FROM media_assets WHERE url=$1',[image.url])).rows[0];await client.query('INSERT INTO product_images(product_id,cloudinary_url,image_order,width,height,source_filename,alt_ar,alt_en) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[saved.id,image.url,i+1,asset?.width||800,asset?.height||800,'admin-'+i,image.alt_ar,image.alt_en])}
 await audit(req.admin.id,'product.save',saved.id,{},client);await client.query('COMMIT');res.json({success:true,id:saved.id,slug:productSlug});
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}
router.post('/products',wrap(saveProduct));router.put('/products/:id',wrap(saveProduct));
for(const kind of ['categories','brands']){
 const brand=kind==='brands';
 async function save(req,res){const b=req.body,nameAr=text(b.name_ar,255),nameEn=text(b.name_en||b.name,255);if(!nameAr&&!nameEn)fail('A name is required');const state=b.status||'ACTIVE';if(!['ACTIVE','INACTIVE'].includes(state))fail('Invalid status');const fields={name_ar:nameAr,name_en:nameEn,status:state,priority:integer(b.priority||0,-100000,100000),image_url:media.validateUrl(b.image_url),image_alt_ar:text(b.image_alt_ar||nameAr,500),image_alt_en:text(b.image_alt_en||nameEn,500)};if(brand)fields.name=nameEn||nameAr;let result;
 if(req.params.id){const values=Object.values(fields);values.push(id(req.params.id));result=await db.query(`UPDATE ${kind} SET ${Object.keys(fields).map((k,i)=>k+'=$'+(i+1)).join(',')},updated_at=NOW() WHERE id=$${values.length} RETURNING *`,values);if(!result.rows.length)fail('Not found',404)}
 else{fields.slug=newSlug(b);if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fields.slug))fail('Invalid URL');result=await db.query(`INSERT INTO ${kind}(${Object.keys(fields).join(',')}) VALUES(${Object.keys(fields).map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,Object.values(fields))}
 await audit(req.admin.id,kind+'.save',result.rows[0].id);res.json(result.rows[0]);}
 router.post('/'+kind,wrap(save));router.put('/'+kind+'/:id',wrap(save));
}
module.exports=router;
