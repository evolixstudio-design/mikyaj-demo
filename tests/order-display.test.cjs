const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),cheerio=require('cheerio');
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function source(file,context){const code=fs.readFileSync(require.resolve(file),'utf8').replace(/^import .*;\s*$/gm,'').replace(/export (async )?function /g,'$1function ').replace(/export const /g,'const ');vm.createContext(context);vm.runInContext(code,context);return context}
test('English and bilingual order items keep product links, quantities, thumbnail sizes and escape buyer-facing content',()=>{
 const c=source('../frontend/mikyaj-demo/js/admin/order-products.js',{localStorage:{getItem:()=>null},esc:escape,imageUrl:(url,width)=>url.replace('image.webp','image-w'+width+'.webp')});
 const item={product_id:1,product_slug:'cleanser',product_live:true,quantity:2,price_at_purchase:1.89,product_name_en:'Cleanser <script>',product_name_ar:'منظف',image_url:'https://mikyajkw.com/mikyaj/v1/product/a/image.webp'};
 const $=cheerio.load(c.orderProducts([item],'en'));assert.equal($('a').attr('href'),'/en/products/cleanser');assert.match($('img').attr('src'),/image-w240.webp/);assert.match($.text(),/Cleanser <script>/);assert.equal($('script').length,0);assert.match($.text(),/3.780 KWD/);
 assert.match(c.orderProducts([item],'both'),/منظف/);assert.match(c.orderProducts([{...item,product_live:false}]),/view=product&amp;id=1/);
});
test('order cards link to private tracking without tokens and use Kuwait delivery dates',()=>{
 const c=source('../frontend/mikyaj-demo/js/delivery-estimate.js',{t:(en)=>en,lang:'en',esc:escape,url:(file,q)=>'/'+file+'?order='+q.order,kwd:v=>Number(v).toFixed(3)+' KWD',statusLabel:v=>v});
 const o={order_number:'0001',status:'CONFIRMED',total_amount:3,delivery_estimated_from:'2026-11-03T23:00:00Z',delivery_estimated_to:'2026-11-05T23:00:00Z'};
 assert.match(c.deliveryEstimate(o),/4 Nov.*6 Nov/);assert.equal(c.deliveryEstimate({...o,status:'CANCELLED'}),'');
 const $=cheerio.load(c.orderCard(o));assert.equal($('a').attr('href'),'/track.html?order=0001');assert.match($.text(),/Track order/);assert.doesNotMatch($.html(),/token|bearer/i);
});
test('admin install manifest opens orders and the push worker never caches private pages',()=>{
 const manifest=JSON.parse(fs.readFileSync(require.resolve('../frontend/mikyaj-demo/admin/site.webmanifest'),'utf8'));
 assert.equal(manifest.start_url,'/admin/manage.html?view=orders');assert.equal(manifest.scope,'/admin/');
 const sw=fs.readFileSync(require.resolve('../frontend/mikyaj-demo/admin/order-alerts-sw.js'),'utf8');assert.doesNotMatch(sw,/addEventListener\(['"]fetch/);assert.doesNotMatch(sw,/caches\./);
});
