const crypto = require('node:crypto');
const db = require('../db');
const { getSettings, setSettings, audit } = require('./commerce-settings');
const { validateUrl } = require('./media');
const { fail } = require('./commerce-quote');
const { bannerPlacements, bannerMarkup } = require('../../frontend/mikyaj-demo/js/banner-markup.mjs');
const text = (value, max) => String(value ?? '').trim().slice(0,max);
function safeLink(value) {
    let link = text(value || '/shop.html',1000);
    if (/^https?:\/\//i.test(link)) {
        let url;try{url=new URL(link)}catch{fail('Use a valid link to a page on this store.');}
        if(!['https://mikyajkw.com',process.env.FRONTEND_URL].includes(url.origin))fail('Choose a link to a page on the Mikyaj website.');
        link=url.pathname+url.search+url.hash;
    }
    if (!/^\/(?!\/)[A-Za-z0-9_/.?=&%#\-]*$/.test(link) || /^\/(?:admin|api|__preview)(?:\/|\?|$)/.test(link)) fail('Choose a public storefront link, such as /shop.html?offers=true or /en/products/product-slug.');
    return link;
}
function clean(body, publish = false) {
    if (!bannerPlacements[body.placement]) fail('Choose a banner placement.');
    const value = { placement:body.placement, kind:['offer','product','seasonal'].includes(body.kind)?body.kind:'seasonal', fit:body.fit==='cover'?'cover':'contain', link_url:safeLink(body.link_url) };
    for (const key of ['title_en','title_ar','image_alt_en','image_alt_ar','seo_description_en','seo_description_ar']) value[key]=text(body[key],key.startsWith('seo_')?320:180);
    value.image_url=validateUrl(body.image_url);
    for (const key of ['focus_x','focus_y']) { const n=Number(body[key]??50); if(!Number.isFinite(n)||n<0||n>100)fail('Image focus must be from 0 to 100.'); value[key]=n; }
    for (const key of ['image_width','image_height']) { const n=Number(body[key]||0); if(!Number.isSafeInteger(n)||n<0||n>40000)fail('Invalid image dimensions.'); value[key]=n; }
    value.priority=Number(body.priority||0);if(!Number.isSafeInteger(value.priority)||Math.abs(value.priority)>1000)fail('Priority must be an integer from -1000 to 1000.');
    if(publish&&(!value.image_url||!value.image_alt_en||!value.image_alt_ar))fail('Upload an image and add English and Arabic image descriptions before publishing.');
    return value;
}
async function state(connection=db) { const value=await getSettings('banners',connection); return {revision:Number(value.revision||0),items:Array.isArray(value.items)?value.items:[]}; }
async function publicBanners(connection=db) { return (await state(connection)).items.filter(item=>item.published).map(item=>({id:item.id,...item.published})).sort((a,b)=>b.priority-a.priority); }
async function mutate(req, operation) {
    const client=await db.pool.connect();
    try {
        await client.query('BEGIN');
        await client.query("INSERT INTO store_settings(key,value) VALUES('banners','{\"revision\":0,\"items\":[]}'::jsonb) ON CONFLICT(key) DO NOTHING");
        const current=(await client.query("SELECT value FROM store_settings WHERE key='banners' FOR UPDATE")).rows[0].value;
        current.revision=Number(current.revision||0);current.items=Array.isArray(current.items)?current.items:[];
        if(!Number.isSafeInteger(req.body.revision)||req.body.revision!==Number(current.revision||0))fail('Banner content changed in another window. Refresh and try again.',409);
        const result=operation(current);current.revision+=1;
        await setSettings('banners',current,client);
        await audit(req.admin.id,'content.banner.'+req.bannerAction,result?.id||req.params.id||'banners',{revision:current.revision},client);
        await client.query('COMMIT');return {revision:current.revision,banner:result};
    } catch(error) { await client.query('ROLLBACK');throw error; } finally { client.release(); }
}
function find(current,id) { const item=current.items.find(item=>item.id===id);if(!item)fail('Banner not found.',404);return item; }
function create(current,body) { if(current.items.length>=25)fail('Use up to 25 banner designs.');const item={id:crypto.randomUUID(),draft:clean(body),published:null,updated_at:new Date().toISOString()};current.items.push(item);return item; }
function apply(homeHtml,banners,lang) { // SSR uses the exact same image/link markup as the browser.
    for(const placement of Object.keys(bannerPlacements)){const content=banners.filter(b=>b.placement===placement).map(b=>bannerMarkup(b,lang)).join('');if(content)homeHtml=homeHtml.replace(new RegExp(`(<div data-banner-slot="${placement}">)([\\s\\S]*?)(<!--/banner-slot--></div>)`),(_,open,old,close)=>open+content+close);}
    return homeHtml;
}
module.exports={state,publicBanners,mutate,find,create,clean,apply,bannerMarkup,bannerPlacements,safeLink};
