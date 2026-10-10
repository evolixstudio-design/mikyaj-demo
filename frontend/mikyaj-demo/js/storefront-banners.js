import {$,lang,params} from './ui.js';
import {bannerMarkup} from './banner-markup.mjs';
export function renderBanners(banners=[]){
 for(const slot of document.querySelectorAll('[data-banner-slot]')){
  const rows=banners.filter(b=>b.placement===slot.dataset.bannerSlot);
  if(rows.length)slot.innerHTML=rows.map(b=>bannerMarkup(b,lang)).join('');
 }
 const hero=banners.find(b=>b.placement==='hero');if(hero?.['seo_description_'+lang]&&document.body.dataset.page==='home')$('meta[name=description]')?.setAttribute('content',hero['seo_description_'+lang]);
}
export async function startContentEditor(){
 if(params.get('content_admin')!=='1')return;
 $('meta[name=robots]')?.setAttribute('content','noindex,nofollow');
 const {manage,session,toast,esc}=await import('./admin/core.js');
 if(!session()?.token){location.href='/admin/login.html';return;}
 let state;try{await manage('/session');state=await manage('/content/banners')}catch(e){toast(e.message);return;}
 document.body.classList.add('content-editor-active');
 const bar=document.createElement('div');bar.className='content-edit-toolbar';bar.innerHTML='<strong>Storefront content editor</strong><span>Select a placement to upload, preview and publish.</span><a href="/admin/manage.html?view=banners">Banners module</a><a href="/en/">Exit editor</a>';$('#main').prepend(bar);
 for(const slot of document.querySelectorAll('[data-banner-slot]')){
  const label=(await import('./banner-markup.mjs')).bannerPlacements[slot.dataset.bannerSlot];
  const tools=document.createElement('div');tools.className='banner-slot-tools';tools.innerHTML=`<strong>${esc(label)}</strong><button class="button secondary" type="button">Place banner here</button>`;slot.prepend(tools);
  $('button',tools).onclick=async()=>{const {editBanner}=await import('./admin/banner-editor.js');const existing=state.items.find(i=>i.published?.placement===slot.dataset.bannerSlot)||state.items.find(i=>i.draft?.placement===slot.dataset.bannerSlot);await editBanner(existing,{placement:slot.dataset.bannerSlot,revision:state.revision,onSaved:()=>location.reload()});};
 }
 document.addEventListener('click',e=>{const anchor=e.target.closest('a');if(anchor&&anchor.origin===location.origin&&(/\/(?:ar|en)\//.test(anchor.pathname)||['/','/index.html','/shop.html','/product.html'].includes(anchor.pathname))){const u=new URL(anchor.href);u.searchParams.set('content_admin','1');anchor.href=u.href}});
}
