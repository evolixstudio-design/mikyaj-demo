import {$,esc,api,field,dialog,toast,safeRead} from '../ui.js';
export {$,esc,field,dialog,toast};
export const session=()=>safeRead('mikyaj_admin_session',null);
export const request=(path,options={})=>api(path,{...options,headers:{Authorization:'Bearer '+session()?.token,...options.headers}});
export const manage=(path,options)=>request('/manage'+path,options);
export const link=(view,extras={})=>'/admin/manage.html?'+new URLSearchParams({view,...extras});
export const money=value=>Number(value||0).toFixed(3)+' KWD';
export const select=(label,key,options,value='')=>`<label class="field">${esc(label)}<select name="${esc(key)}">${options.map(o=>{const[v,n]=Array.isArray(o)?o:[o,o];return `<option value="${esc(v)}" ${String(value??'')===String(v)?'selected':''}>${esc(n)}</option>`}).join('')}</select></label>`;
export const textarea=(label,key,value='',extra='')=>`<label class="field">${esc(label)}<textarea name="${esc(key)}" ${extra}>${esc(value)}</textarea></label>`;
export const panel=(title,body)=>`<section class="panel"><h2>${esc(title)}</h2>${body}</section>`;
export const content=html=>{$('#admin-content').innerHTML=html};
export function submit(form,fn){form.onsubmit=async event=>{event.preventDefault();if(!form.reportValidity())return;const button=$('[type=submit]',form);button.disabled=true;try{await fn(Object.fromEntries(new FormData(form)),form);toast('Saved successfully')}catch(error){const alert=$('[role=alert]',form);if(alert)alert.textContent=error.message;else toast(error.message)}finally{button.disabled=false}}}
export function watchChanges(form){let dirty=false;const mark=()=>{dirty=true;document.body.classList.add('has-unsaved')};form.addEventListener('input',mark);form.addEventListener('change',mark);const before=event=>{if(dirty){event.preventDefault();event.returnValue=''}};window.addEventListener('beforeunload',before);return {mark,clean(){dirty=false;document.body.classList.remove('has-unsaved')},get dirty(){return dirty}}}
export function download(data,filename,type='text/csv'){const url=URL.createObjectURL(new Blob([data],{type}));const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export async function upload(file,purpose='product'){if(file.size>4*1024*1024)throw Error('Choose an image smaller than 4 MB.');const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});return manage('/images',{method:'POST',body:{data,purpose}})}
export function imagePicker(root,purpose,value={},changed=()=>{}){
 root.innerHTML=`<div class="media-picker"><button class="image-preview-button" type="button" aria-label="Enlarge uploaded image" ${value.image_url?'':'hidden'}><img alt="Uploaded image preview" ${value.image_url?'src="'+esc(value.image_url)+'"':''} width="240" height="180"></button><label class="field">${purpose==='product'?'Product image':'Image'}<input type="file" accept="image/jpeg,image/png,image/webp"></label><p class="small muted">JPEG, PNG or WebP · up to 4 MB. Select a file to preview it before saving.</p><input type="hidden" name="image_url" value="${esc(value.image_url||'')}"><p role="status"></p></div>`;
 const input=$('[type=file]',root),button=$('.image-preview-button',root),preview=$('img',root),status=$('[role=status]',root);
 button.onclick=()=>dialog('Image preview',`<img class="full-image-preview" src="${esc(preview.src)}" alt="Uploaded image preview">`);
 input.onchange=async()=>{const file=input.files[0];if(!file)return;const previous=$('[name=image_url]',root).value,local=URL.createObjectURL(file),save=root.closest('form')?.querySelector('[type=submit]');input.disabled=true;if(save)save.disabled=true;button.hidden=false;preview.src=local;status.textContent='Preview · processing upload…';
 try{const image=await upload(file,purpose);$('[name=image_url]',root).value=image.url;preview.src=image.url;changed();status.textContent='Image ready. Save to apply it.'}
 catch(e){status.textContent=e.message;preview.src=previous||'';button.hidden=!previous}
 finally{URL.revokeObjectURL(local);input.disabled=false;if(save)save.disabled=false;input.value=''}
 };
}
let translationCapabilities;
export function autoTranslate(form){
 translationCapabilities??=manage('/translate').catch(()=>({configured:false}));
 for(const source of form.querySelectorAll('input[name$="_ar"],input[name$="_en"],textarea[name$="_ar"],textarea[name$="_en"]')){
  const language=source.name.slice(-2),target=form.elements[source.name.slice(0,-2)+(language==='ar'?'en':'ar')];if(!target)continue;
  source.addEventListener('blur',async()=>{const original=source.value;if(!original.trim()||target.value.trim()||!(await translationCapabilities).configured)return;const message=document.createElement('small');message.role='status';message.textContent='Translating…';target.after(message);
   try{const result=await manage('/translate',{method:'POST',body:{text:original,source:language,target:language==='ar'?'en':'ar'}});if(source.value===original&&!target.value.trim()){target.value=result.text;target.dispatchEvent(new Event('input',{bubbles:true}));message.textContent='Machine translation — please review.'}else message.remove()}catch(e){message.textContent=e.message}
  });
 }
}
