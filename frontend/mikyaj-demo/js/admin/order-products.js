import {esc} from './core.js';
import {imageUrl} from '../ui.js';
export const orderLanguage=()=>localStorage.getItem('mikyaj_order_language')||'en';
export function languageControl(){return `<label class="field order-language">Order product language<select data-order-language><option value="en" ${orderLanguage()==='en'?'selected':''}>English</option><option value="ar" ${orderLanguage()==='ar'?'selected':''}>العربية</option><option value="both" ${orderLanguage()==='both'?'selected':''}>English + العربية</option></select></label>`}
export function orderProducts(items=[],language=orderLanguage()){
 return items.map(i=>{const en=i.product_name_en||i.product_name||'English name not provided',ar=i.product_name_ar||en,title=language==='ar'?ar:en,variant=language==='ar'?i.variant_name_ar:i.variant_name_en;
 const href=i.product_slug?(i.product_live?'/'+(language==='ar'?'ar':'en')+'/products/'+encodeURIComponent(i.product_slug):'/admin/manage.html?view=product&id='+Number(i.product_id)):null;
 const name=`${esc(title)}${variant?' · '+esc(variant):''}${language==='both'?'<small dir="rtl">'+esc(ar)+(i.variant_name_ar?' · '+esc(i.variant_name_ar):'')+'</small>':''}`;
 return `<div class="admin-order-product">${i.image_url?`<img src="${esc(imageUrl(i.image_url,240))}" alt="${esc(title)}" width="48" height="48" loading="lazy">`:'<span class="order-image-empty" aria-hidden="true">—</span>'}<div>${href?`<a href="${esc(href)}" target="_blank" rel="noopener" dir="auto">${name} ↗</a>`:`<span dir="auto">${name}</span>`}<small>Qty ${Number(i.quantity)}${i.price_at_purchase?' · '+(Number(i.price_at_purchase)*i.quantity).toFixed(3)+' KWD':''}</small></div></div>`;
 }).join('');
}
export function bindOrderLanguage(root,render){const input=root.querySelector('[data-order-language]');if(input)input.onchange=()=>{localStorage.setItem('mikyaj_order_language',input.value);render(input.value)}}
export async function englishArea(address){if(!address||typeof address!=='object')return null;try{const r=await fetch('/api/store/config');if(!r.ok)return null;const c=await r.json(),a=c.delivery_directory.find(a=>[a.name_en,a.name_ar,...(a.aliases||[])].includes(address.area));return a?.name_en||null}catch{return null}}
