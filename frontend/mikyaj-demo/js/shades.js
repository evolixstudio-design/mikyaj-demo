import {$,t,esc,lang,imageUrl,toast,productUrl} from './ui.js';
const selected=new Map();
export function selectedShade(id){return selected.get(id)}
export function renderShades(p){
 if(!p.variants_enabled||!p.variants?.length)return;
 selected.delete(p.id);
 if(p.variant_type==='fragrance'){
  const panel=document.createElement('div');panel.className='product-shades';
  panel.innerHTML=`<label class="field" for="product-fragrance"><strong>${t('Choose your fragrance','اختاري الرائحة')}</strong><select id="product-fragrance" aria-describedby="fragrance-help"><option value="">${t('Select a fragrance','اختاري الرائحة')}</option>${p.variants.map(v=>`<option value="${v.id}" ${v.stock_status==='OUT_OF_STOCK'?'disabled':''}>${esc(v['name_'+lang]||v.name_en)}${v.stock_status==='OUT_OF_STOCK'?' — '+t('Out of stock','غير متوفر'):''}</option>`).join('')}</select></label><p id="fragrance-help" class="small">${t('Price is for one bottle in your selected fragrance.','السعر لعبوة واحدة بالرائحة التي تختارينها.')}</p>`;
  $('.purchase-row').before(panel);
  const buttons=[...document.querySelectorAll(`[data-add="${p.id}"]`)];buttons.forEach(b=>b.disabled=true);
  $('#product-fragrance',panel).onchange=e=>{
   const variant=p.variants.find(v=>String(v.id)===e.target.value&&v.stock_status!=='OUT_OF_STOCK');
   if(variant)selected.set(p.id,variant);else selected.delete(p.id);
   buttons.forEach(button=>button.disabled=!variant||p.stock_status==='OUT_OF_STOCK');
   if(variant?.image_url){$('#galleryMain img').src=imageUrl(variant.image_url,800);$('#galleryMain img').removeAttribute('srcset')}
  };
  return;
 }
 const panel=document.createElement('div');panel.className='product-shades';panel.innerHTML=`<strong>${t('Choose your shade','اختاري درجة اللون')}</strong><p class="small" data-shade-label>${t('Select a colour before adding to your bag.','اختاري اللون قبل الإضافة إلى الحقيبة.')}</p><div class="shade-options">${p.variants.map(v=>`<button type="button" class="shade-swatch" style="background-color:${esc(v.color_hex)}" data-shade="${v.id}" aria-pressed="false" aria-label="${esc(v['name_'+lang])}" title="${esc(v['name_'+lang])}" ${v.stock_status==='OUT_OF_STOCK'?'disabled':''}></button>`).join('')}</div>`;
 $('.purchase-row').before(panel);const buttons=[...document.querySelectorAll(`[data-add="${p.id}"]`)];buttons.forEach(b=>b.disabled=true);
 panel.querySelectorAll('[data-shade]').forEach(b=>b.onclick=()=>{const v=p.variants.find(v=>String(v.id)===b.dataset.shade);selected.set(p.id,v);panel.querySelectorAll('[data-shade]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$('[data-shade-label]',panel).textContent=v['name_'+lang];buttons.forEach(x=>x.disabled=p.stock_status==='OUT_OF_STOCK');if(v.image_url){$('#galleryMain img').src=imageUrl(v.image_url,800);$('#galleryMain img').removeAttribute('srcset')}});
}
export function requireShade(p){if(p?.has_shades&&!selected.has(p.id)){location.href=productUrl(p);return false}return true}
