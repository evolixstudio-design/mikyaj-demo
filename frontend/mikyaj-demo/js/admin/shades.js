import {$,esc,field,dialog,toast,manage,select,panel,submit,imagePicker} from './core.js';
export async function shadesEditor(id){
 const root=document.createElement('section');root.id='shade-editor';$('#product-editor').after(root);
 let fragrance=false;
 async function load(){
  const d=await manage('/products/'+id+'/variants');fragrance=d.variant_type==='fragrance';
  const noun=fragrance?'fragrance':'shade';
  root.innerHTML=panel(fragrance?'Fragrances / variants':'Colour shades / variants',`
   <p class="small muted">All options use this product’s price. Publish the options and enable them below before customers can select them.</p>
   <label class="field">Option type<select id="variant-type"><option value="shade" ${!fragrance?'selected':''}>Colour shades</option><option value="fragrance" ${fragrance?'selected':''}>Fragrances</option></select></label>
   <label class="check-row"><input id="enable-shades" type="checkbox" ${d.enabled?'checked':''}>Show published ${fragrance?'fragrances':'shades'} on the storefront</label>
   <button class="button secondary" id="add-shade" type="button">Add ${noun}</button>
   <div class="table-wrap"><table><thead><tr><th>${fragrance?'Fragrance':'Shade'}</th><th>SKU</th><th>Quantity</th><th>Status</th><th></th></tr></thead><tbody>${d.variants.map(v=>`<tr><td>${!fragrance?`<span style="display:inline-block;width:22px;height:22px;background:${esc(v.color_hex)};border:1px solid #ddd;vertical-align:middle"></span> `:''}${esc(v.name_en)} / ${esc(v.name_ar)}</td><td>${esc(v.sku)}</td><td>${v.inventory_quantity??'Not tracked'}</td><td>${esc(v.status)} · ${esc(v.stock_status)}</td><td><button class="button secondary" type="button" data-edit-shade="${v.id}">Edit</button></td></tr>`).join('')||`<tr><td colspan="5">No ${fragrance?'fragrances':'shades'} added.</td></tr>`}</tbody></table></div>`);
  $('#enable-shades').onchange=async e=>{try{await manage('/products/'+id+'/variants',{method:'PUT',body:{enabled:e.target.checked,variant_type:fragrance?'fragrance':'shade'}});toast('Option visibility saved')}catch(err){e.target.checked=!e.target.checked;toast(err.message)}};
  $('#variant-type').onchange=async e=>{try{await manage('/products/'+id+'/variants',{method:'PUT',body:{enabled:d.enabled,variant_type:e.target.value}});await load();toast('Option type saved')}catch(err){e.target.value=fragrance?'fragrance':'shade';toast(err.message)}};
  $('#add-shade').onclick=()=>edit({});
  root.querySelectorAll('[data-edit-shade]').forEach(b=>b.onclick=()=>edit(d.variants.find(v=>String(v.id)===b.dataset.editShade)));
 }
 function edit(v){
  const noun=fragrance?'fragrance':'shade';
  const modal=dialog((v.id?'Edit ':'Add ')+noun,`<form><div class="form-grid">${field('English '+noun+' name','name_en',v.name_en,'text','required maxlength="100"')}${field('Arabic '+noun+' name','name_ar',v.name_ar,'text','required maxlength="100" dir="auto"')}${fragrance?`<input type="hidden" name="color_hex" value="${esc(v.color_hex||'#b06d75')}">`:field('Swatch colour','color_hex',v.color_hex||'#b06d75','color')}${field('SKU (optional)','sku',v.sku)}${field('Available quantity (blank = not tracked)','inventory_quantity',v.inventory_quantity??'','number','min="0" step="1"')}${select('Stock','stock_status',['IN_STOCK','OUT_OF_STOCK'],v.stock_status||'IN_STOCK')}${select('Publishing','status',['DRAFT','ACTIVE','ARCHIVED'],v.status||'DRAFT')}${field('Display priority','priority',v.priority||0,'number')}</div><div id="shade-image"></div><p role="alert"></p><button class="button" type="submit">Save ${noun}</button></form>`);
  imagePicker($('#shade-image',modal),'product',v);
  submit($('form',modal),async b=>{await manage('/products/'+id+'/variants'+(v.id?'/'+v.id:''),{method:v.id?'PUT':'POST',body:b});modal.close();load()});
 }
 await load();
}
