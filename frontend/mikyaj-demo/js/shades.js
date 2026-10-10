import {$,t,esc,lang,imageUrl,toast,productUrl} from './ui.js';
const selected=new Map();
export function selectedShade(id){return selected.get(id)}
export function renderShades(p){
 if(!p.variants_enabled||!p.variants?.length)return;
 const panel=document.createElement('div');panel.className='product-shades';panel.innerHTML=`<strong>${t('Choose your shade','اختاري درجة اللون')}</strong><p class="small" data-shade-label>${t('Select a colour before adding to your bag.','اختاري اللون قبل الإضافة إلى الحقيبة.')}</p><div class="shade-options">${p.variants.map(v=>`<button type="button" class="shade-swatch" style="background-color:${esc(v.color_hex)}" data-shade="${v.id}" aria-pressed="false" aria-label="${esc(v['name_'+lang])}" title="${esc(v['name_'+lang])}" ${v.stock_status==='OUT_OF_STOCK'?'disabled':''}></button>`).join('')}</div>`;
 $('.purchase-row').before(panel);const buttons=[...document.querySelectorAll(`[data-add="${p.id}"]`)];buttons.forEach(b=>b.disabled=true);
 panel.querySelectorAll('[data-shade]').forEach(b=>b.onclick=()=>{const v=p.variants.find(v=>String(v.id)===b.dataset.shade);selected.set(p.id,v);panel.querySelectorAll('[data-shade]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$('[data-shade-label]',panel).textContent=v['name_'+lang];buttons.forEach(x=>x.disabled=p.stock_status==='OUT_OF_STOCK');if(v.image_url){$('#galleryMain img').src=imageUrl(v.image_url,800);$('#galleryMain img').removeAttribute('srcset')}});
}
export function requireShade(p){if(p?.has_shades&&!selected.has(p.id)){location.href=productUrl(p);return false}return true}
