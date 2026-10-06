const db=require('../db');
const crypto=require('node:crypto');
const fail=message=>{throw Object.assign(new Error(message),{status:400})};
const fils=n=>Math.round(Number(n)*1000);
const matches=(p,target,ids)=>target==='ALL'||ids.includes(target==='PRODUCTS'?p.productId:target==='CATEGORIES'?p.category_id:p.brand_id);
const saving=(price,d)=>Math.min(price,d.value_type==='PERCENT'?Math.round(price*Number(d.value)/100):fils(d.value));
const customerKey=(id,phone)=>crypto.createHash('sha256').update(id?'customer:'+id:'phone:'+String(phone||'')).digest('hex');
function calculate(d,lines,deliveryFils){
 const subtotal=lines.reduce((sum,p)=>sum+p.price_fils*p.qty,0);if(subtotal<fils(d.minimum_amount))return 0;
 if(d.type==='SHIPPING')return deliveryFils||0;
 if(d.type==='ORDER')return saving(subtotal,d);
 if(d.type==='PRODUCT')return lines.filter(p=>!p.offer&&matches(p,d.target,d.target_ids)).reduce((sum,p)=>sum+saving(p.price_fils,d)*p.qty,0);
 const units=lines.filter(p=>!p.offer).flatMap(p=>Array.from({length:p.qty},()=>({price:p.price_fils,buy:matches(p,d.target,d.target_ids),get:matches(p,d.get_target,d.get_ids)})));
 // Each unit can be used only once, either as a qualifying purchase or as a reward.
 // Choose the cheapest rewards, keeping higher-value qualifying purchases paid.
 const buyers=units.filter(p=>p.buy).sort((a,b)=>b.price-a.price),rewards=units.filter(p=>p.get).sort((a,b)=>a.price-b.price),used=new Set();let discount=0;
 while(true){const chosenBuy=buyers.filter(p=>!used.has(p)).slice(0,d.buy_quantity);if(chosenBuy.length<d.buy_quantity)break;const chosenGet=rewards.filter(p=>!used.has(p)&&!chosenBuy.includes(p)).slice(0,d.get_quantity);if(chosenGet.length<d.get_quantity)break;for(const p of [...chosenBuy,...chosenGet])used.add(p);discount+=chosenGet.reduce((sum,p)=>sum+saving(p.price,d),0)}return discount;
}
async function apply(lines,deliveryFils,context={},connection=db){
 const code=String(context.code||'').trim().toUpperCase();if(code&&!/^[A-Z0-9_-]{3,40}$/.test(code))fail('Enter a valid discount code.');
 if(context.lock)await connection.query('SELECT id FROM discounts WHERE active ORDER BY id FOR UPDATE');
 const rows=(await connection.query("SELECT d.*, (SELECT COUNT(*) FROM discount_redemptions r WHERE r.discount_id=d.id AND NOT r.released)::int uses, EXISTS(SELECT 1 FROM discount_redemptions r WHERE r.discount_id=d.id AND r.customer_key=$1 AND NOT r.released) used_by_customer FROM discounts d WHERE active AND starts_at<=NOW() AND (ends_at IS NULL OR ends_at>NOW()) AND (method='AUTOMATIC' OR code=$2) ORDER BY id",[context.customer_key||'',code])).rows;
 const candidates=rows.filter(d=>(!d.usage_limit||d.uses<d.usage_limit)&&(!d.once_per_customer||context.customer_key&&!d.used_by_customer)).map(d=>({...d,amount:calculate(d,lines,deliveryFils)})).filter(d=>d.amount>0);
 const explicit=code?candidates.find(d=>d.code===code):null;if(code&&!explicit)fail('This discount code is unavailable or your bag does not qualify.');
 const onePerClass=offers=>[...offers].sort((a,b)=>a===explicit?-1:b===explicit?1:b.amount-a.amount).filter((d,i,all)=>all.findIndex(x=>(x.type==='BXGY'?'PRODUCT':x.type)===(d.type==='BXGY'?'PRODUCT':d.type))===i);
 const totalSaving=offers=>Math.min(lines.reduce((n,p)=>n+p.price_fils*p.qty,0),offers.filter(d=>d.type!=='SHIPPING').reduce((n,d)=>n+d.amount,0))+Math.min(deliveryFils||0,offers.filter(d=>d.type==='SHIPPING').reduce((n,d)=>n+d.amount,0));
 let selected;
 if(explicit)selected=explicit.combines?[explicit,...candidates.filter(d=>d.id!==explicit.id&&d.combines&&d.method==='AUTOMATIC')]:[explicit];
 else{const combinable=onePerClass(candidates.filter(d=>d.combines)),single=[...candidates].sort((a,b)=>b.amount-a.amount)[0];selected=totalSaving(combinable)>(single?.amount||0)?combinable:single?[single]:[]}
 // Combination applies at most one offer per class, avoiding repeated product/shipping discounts.
 selected=onePerClass(selected);
 let remaining=lines.reduce((n,p)=>n+p.price_fils*p.qty,0),shipping=deliveryFils||0;const applied=[];
 for(const d of selected){const amount=Math.min(d.amount,d.type==='SHIPPING'?shipping:remaining);if(d.type==='SHIPPING')shipping-=amount;else remaining-=amount;if(amount)applied.push({id:d.id,title:d.title,title_ar:d.title_ar,code:d.code,amount:(amount/1000).toFixed(3),shipping:d.type==='SHIPPING'})}
 return {applied,product_discount_fils:lines.reduce((n,p)=>n+p.price_fils*p.qty,0)-remaining,shipping_fils:shipping};
}
module.exports={apply,calculate,customerKey};
