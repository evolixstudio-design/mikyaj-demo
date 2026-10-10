const {byIds}=require('./catalog');
const {getSettings}=require('./commerce-settings');
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
function normalizeItems(items){
 if(!Array.isArray(items)||!items.length||items.length>100)fail('Add at least one product to your bag.');
 const quantities=new Map();
 for(const i of items){const id=Number(i.productId),qty=Number(i.qty),variant=i.variantId==null?null:Number(i.variantId);if(!Number.isSafeInteger(id)||id<1||!Number.isInteger(qty)||qty<1||qty>99||(variant!==null&&(!Number.isSafeInteger(variant)||variant<1)))fail('Invalid product or quantity.');const key=id+':'+(variant||'');quantities.set(key,(quantities.get(key)||0)+qty);if(quantities.get(key)>99)fail('Maximum quantity per product is 99.');}
 return [...quantities].map(([key,qty])=>{const [id,v]=key.split(':');return {productId:Number(id),...(v?{variantId:Number(v)}:{}),qty}}).sort((a,b)=>a.productId-b.productId||(a.variantId||0)-(b.variantId||0));
}
function phone(value){const p=String(value||'').replace(/[\s()-]/g,'').replace(/^\+965|^00965|^965(?=\d{8}$)/,'');if(!/^[24569]\d{7}$/.test(p))fail('Enter a valid Kuwait phone number.');return '+965'+p;}
const GOVERNORATES=['Capital','Hawalli','Farwaniya','Ahmadi','Jahra','Mubarak Al-Kabeer'];
function address(a){if(!a||typeof a!=='object'||!GOVERNORATES.includes(a.governorate))fail('Choose a Kuwait governorate.');const result={};for(const key of ['governorate','area','block','street','building','floor','apartment','notes']){result[key]=String(a[key]||'').trim();if(result[key].length>500)fail('Address field is too long.');if(['area','block','street','building'].includes(key)&&!result[key])fail('Complete the delivery address.');}result.postal_code=String(a.postal_code||'').trim();if(result.postal_code&&!/^\d{5}$/.test(result.postal_code))fail('Enter a valid five-digit postal code.');return require('./delivery-directory').validatePostal(result);}
async function quote(items,connection,area='',context={}){
 const normalized=normalizeItems(items),products=await byIds(normalized.map(i=>i.productId),connection);
 const client=connection||require('../db');const variants=(await client.query("SELECT * FROM product_variants WHERE id=ANY($1::bigint[]) ORDER BY id"+(context.lock?' FOR UPDATE':''),[normalized.map(i=>i.variantId).filter(Boolean)])).rows;
 let subtotalFils=0;const lines=normalized.map(i=>{const p=products.find(p=>p.id===i.productId),v=variants.find(v=>Number(v.id)===i.variantId&&v.product_id===i.productId);if(!p||p.stock_status!=='IN_STOCK'||(p.has_shades&&!i.variantId)||(i.variantId&&(!p.variants_enabled||!v||v.status!=='ACTIVE'||v.stock_status!=='IN_STOCK'))||((v?v.inventory_quantity:p.inventory_quantity)!==null&&(v?v.inventory_quantity:p.inventory_quantity)<i.qty))fail('A product is unavailable. Please update your bag.',409);const priceFils=Math.round(Number(p.selling_price)*1000);if(!Number.isSafeInteger(priceFils)||priceFils<1)fail('A product price needs review.',409);subtotalFils+=priceFils*i.qty;return {...i,variant_name_en:v?.name_en,variant_name_ar:v?.name_ar,category_id:p.category_id,brand_id:p.brand_id,offer:p.offer,price_fils:priceFils,name_ar:p.name_ar,name_en:p.name_en,slug:p.slug,image:v?.image_url||p.primary_image?.url,price:(priceFils/1000).toFixed(3),line_total:(priceFils*i.qty/1000).toFixed(3)};});
 const delivery=await getSettings('delivery',connection),threshold=Math.round(Number(delivery.free_threshold)*1000);
 const qualifies=subtotalFils>=threshold;
 const matched=(delivery.areas||[]).find(a=>require('./delivery-directory').match(a,area));
 const fee=matched?matched.fee:delivery.require_area_match?null:delivery.fee;
 const configured=fee!==null&&Number.isFinite(Number(fee));
 const feeFils=configured?(qualifies?0:Math.round(Number(fee)*1000)):null;
 const discount=await require('./discounts').apply(lines,feeFils,context,connection);
 const tax=await getSettings('tax',connection),rate=Number(tax.rate||0),taxBase=subtotalFils-discount.product_discount_fils+(tax.shipping_taxable?discount.shipping_fils:0);const taxFils=tax.enabled&&Number.isFinite(rate)&&rate>=0&&rate<=100?Math.round(taxBase*rate/100):0;
 return {tax_amount:(taxFils/1000).toFixed(3),tax_details:{label:tax.label||'Tax',rate:tax.enabled?rate:0},discounts:discount.applied,discount_amount:(discount.product_discount_fils/1000).toFixed(3),items:lines,subtotal:(subtotalFils/1000).toFixed(3),delivery_fee:feeFils===null?null:(discount.shipping_fils/1000).toFixed(3),total:feeFils===null?null:((subtotalFils-discount.product_discount_fils+discount.shipping_fils+taxFils)/1000).toFixed(3),free_delivery_threshold:(threshold/1000).toFixed(3),remaining_for_free_delivery:(Math.max(0,threshold-subtotalFils)/1000).toFixed(3),delivery_available:delivery.enabled&&feeFils!==null,currency:'KWD'};
}
module.exports={normalizeItems,phone,address,quote,GOVERNORATES,fail};
