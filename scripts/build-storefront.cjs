const fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild');
const {policyContent}=require('../backend/views/policies');
const {shell,homeContent}=require('../backend/views/storefront');
const assetVersion=require('../backend/services/asset-version');
const root=path.join(__dirname,'../frontend/mikyaj-demo');
const {faviconLinks}=require('../backend/views/site-head');
const discovery=require('../backend/services/search-discovery');
const {verificationFile}=require('./configure-search-console.cjs');
async function build(){
await require('./prepare-favicons.cjs').prepareFavicons();
for(const [file,content]of [['robots.txt',discovery.robots()],['sitemap.xml',discovery.sitemapIndex()],['sitemap-pages.xml',discovery.pageSitemap()]])fs.writeFileSync(path.join(root,file),content);
const pages={brands:['brands','الماركات'],index:['home','مكياج وعناية بالبشرة في الكويت'],shop:['shop','تسوقي المكياج والعناية'],product:['product','منتجات الجمال'],cart:['cart','حقيبة التسوق'],checkout:['checkout','إتمام الطلب'],'checkout-result':['result','حالة الطلب'],account:['account','حسابي'],wishlist:['wishlist','المفضلة'],track:['track','متابعة الطلب'],blog:['blog','دليل الجمال'],terms:['terms','الشروط والأحكام'],privacy:['privacy','سياسة الخصوصية'],returns:['returns','الإرجاع والاستبدال'],delivery:['delivery','التوصيل'],contact:['contact','تواصلي معنا']};
for(const[file,[page,title]]of Object.entries(pages))fs.writeFileSync(path.join(root,file+'.html'),shell({page,title,content:page==='home'?homeContent():policyContent(page),initial:page==='home'?{home:{ar:homeContent('ar'),en:homeContent('en')}}:policyContent(page)?{policy:{ar:policyContent(page,'ar'),en:policyContent(page,'en')}}:undefined,robots:['cart','checkout','result','account','wishlist','track','product'].includes(page)?'noindex,follow':'index,follow'}));
for(const lang of ['ar','en'])fs.writeFileSync(path.join(root,'home-'+lang+'.html'),shell({page:'home',lang,content:homeContent(lang),canonical:'https://mikyajkw.com/'+lang+'/',alternates:{ar:'https://mikyajkw.com/ar/',en:'https://mikyajkw.com/en/'}}));
fs.writeFileSync(path.join(root,'404.html'),shell({page:'not-found',title:'Page not found / الصفحة غير موجودة',robots:'noindex,follow',content:'<div class="container section"><h1>404</h1><p>Page not found / الصفحة غير موجودة</p><a href="/">Return to the shop / العودة للمتجر</a></div>'}));
for(const file of ['admin/manage.html','admin/login.html']){const target=path.join(root,file);fs.writeFileSync(target,fs.readFileSync(target,'utf8').replace(/<link rel="(?:icon|apple-touch-icon|manifest)"[^>]*>/g,'').replace('</head>',faviconLinks()+'</head>').replace(/((?:src|href)="\/(?:js|css)\/[^"?]+)(?:\?[^"]*)?"/g,(_,base)=>base+'?v='+assetVersion+'"'));}
if(process.argv.includes('--source-only'))process.exit(0);
const dist=path.join(__dirname,'../dist');if(dist!==path.resolve(__dirname,'../dist'))throw new Error('Unexpected build directory');
if(fs.existsSync(dist)){for(const entry of fs.readdirSync(dist)){const target=path.resolve(dist,entry);if(!target.startsWith(dist+path.sep))throw new Error('Unsafe build target');fs.rmSync(target,{recursive:true,force:true});}}
fs.mkdirSync(dist,{recursive:true});
const taxonomySource=path.join(root,'assets/images/taxonomy');
if(fs.existsSync(taxonomySource)){const target=path.join(dist,'assets/images/taxonomy');fs.mkdirSync(target,{recursive:true});for(const file of fs.readdirSync(taxonomySource))if(/^(category|brand)-[a-z0-9-]+\.webp$/.test(file))fs.copyFileSync(path.join(taxonomySource,file),path.join(target,file));}
// Explicit asset allowlist keeps raw product archives, source tools and secrets out of deployment.
for(const dir of ['css','js','admin','assets/images']){const from=path.join(root,dir),to=path.join(dist,dir);fs.mkdirSync(to,{recursive:true});for(const item of fs.readdirSync(from,{withFileTypes:true})){if(!item.isFile())continue;const file=path.join(from,item.name);if(dir==='js'&&!['ui.js','storefront.js','admin-store.js','admin-legacy.js','analytics.js','address-tools.js','returns.js','checkout-store.js','customer-store.js','policies.js'].includes(item.name))continue;if(dir==='css'&&!['storefront.css','admin.css'].includes(item.name))continue;if(dir==='admin'&&!['manage.html','login.html'].includes(item.name))continue;if(dir==='assets/images'&&!['product_lipstick.webp','product_serum.webp','product_eyeshadow.webp','placeholder.svg','logo-social.png','hero-welcome-480.webp','hero-welcome-800.webp','hero-welcome-1200.webp','hero-welcome-1600.webp'].includes(item.name))continue;fs.copyFileSync(file,path.join(to,item.name));}}
for(const item of fs.readdirSync(root)){if([...Object.keys(pages),'home-ar','home-en'].some(p=>item===p+'.html')||/^(favicon|apple-touch-icon).*\.png$/.test(item)||['robots.txt','sitemap.xml','sitemap-pages.xml','site.webmanifest','favicon.ico','404.html'].includes(item))fs.copyFileSync(path.join(root,item),path.join(dist,item));}
for(const file of fs.readdirSync(root).filter(file=>/^google[a-f0-9]+\.html$/i.test(file))){verificationFile(file,fs.readFileSync(path.join(root,file),'utf8'));fs.copyFileSync(path.join(root,file),path.join(dist,file));}
esbuild.buildSync({entryPoints:['ui','storefront','admin-store','checkout-store','customer-store','policies'].map(name=>path.join(root,'js',name+'.js')),outdir:path.join(dist,'js'),bundle:true,splitting:true,chunkNames:'chunks/[name]-[hash]',minify:true,target:'es2020',format:'esm'});
const adminCss=esbuild.transformSync(fs.readFileSync(path.join(root,'css/admin.css'),'utf8'),{minify:true,loader:'css'});fs.writeFileSync(path.join(dist,'css/admin.css'),adminCss.code);
esbuild.buildSync({entryPoints:[path.join(root,'css/storefront.css')],outfile:path.join(dist,'css/storefront.css'),bundle:true,minify:true});
console.log('Built storefront in dist (only production assets, crawl files and real-logo favicons).');
}
build().catch(error=>{console.error(error.message);process.exitCode=1});
