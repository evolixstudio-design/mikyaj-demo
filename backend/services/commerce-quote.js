const {byIds}=require('./catalog');
const {getSettings}=require('./commerce-settings');
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
function normalizeItems(items){
 if(!Array.isArray(items)||!items.length||items.length>100)fail('Add at least one product to your bag.');
 const quantities=new Map();
 for(const i of items){const id=Number(i.productId),qty=Number(i.qty);if(!Number.isSafeInteger(id)||id<1||!Number.isInteger(qty)||qty<1||qty>99)fail('Invalid product or quantity.');quantities.set(id,(quantities.get(id)||0)+qty);if(quantities.get(id)>99)fail('Maximum quantity per product is 99.');}
 return [...quantities].sort((a,b)=>a[0]-b[0]).map(([productId,qty])=>({productId,qty}));
}
function phone(value){const p=String(value||'').replace(/[\s()-]/g,'').replace(/^\+965|^00965|^965(?=\d{8}$)/,'');if(!/^[24569]\d{7}$/.test(p))fail('Enter a valid Kuwait phone number.');return '+965'+p;}
const GOVERNORATES=['Capital','Hawalli','Farwaniya','Ahmadi','Jahra','Mubarak Al-Kabeer'];
function address(a){if(!a||typeof a!=='object'||!GOVERNORATES.includes(a.governorate))fail('Choose a Kuwait governorate.');const result={};for(const key of ['governorate','area','block','street','building','floor','apartment','notes']){result[key]=String(a[key]||'').trim();if(result[key].length>500)fail('Address field is too long.');if(['area','block','street','building'].includes(key)&&!result[key])fail('Complete the delivery address.');}return result;}
async function quote(items,connection,area=''){
 const normalized=normalizeItems(items),products=await byIds(normalized.map(i=>i.productId),connection);
 let subtotalFils=0;const lines=normalized.map(i=>{const p=products.find(p=>p.id===i.productId);if(!p||p.stock_status!=='IN_STOCK')fail('A product is unavailable. Please update your bag.',409);const priceFils=Math.round(Number(p.selling_price)*1000);if(!Number.isSafeInteger(priceFils)||priceFils<1)fail('A product price needs review.',409);subtotalFils+=priceFils*i.qty;return {...i,name_ar:p.name_ar,name_en:p.name_en,slug:p.slug,image:p.primary_image?.url,price:(priceFils/1000).toFixed(3),line_total:(priceFils*i.qty/1000).toFixed(3)};});
 const delivery=await getSettings('delivery',connection),threshold=Math.round(Number(delivery.free_threshold)*1000);
 const qualifies=subtotalFils>=threshold;
 const matched=(delivery.areas||[]).find(a=>[a.name_en,a.name_ar].some(n=>String(n).trim().toLowerCase()===String(area).trim().toLowerCase()));
 const fee=matched?matched.fee:delivery.require_area_match?null:delivery.fee;
 const configured=fee!==null&&Number.isFinite(Number(fee));
 const feeFils=qualifies?0:configured?Math.round(Number(fee)*1000):null;
 return {items:lines,subtotal:(subtotalFils/1000).toFixed(3),delivery_fee:feeFils===null?null:(feeFils/1000).toFixed(3),total:feeFils===null?null:((subtotalFils+feeFils)/1000).toFixed(3),free_delivery_threshold:(threshold/1000).toFixed(3),remaining_for_free_delivery:(Math.max(0,threshold-subtotalFils)/1000).toFixed(3),delivery_available:delivery.enabled&&feeFils!==null,currency:'KWD'};
}
module.exports={normalizeItems,phone,address,quote,GOVERNORATES,fail};
