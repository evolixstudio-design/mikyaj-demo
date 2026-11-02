const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const request=require('supertest'),cheerio=require('cheerio'),fs=require('node:fs'),path=require('node:path');
let fixture,app;
before(async()=>{fixture=await require('./isolated-db.cjs').setup();app=require('../backend/app').createApp()});
after(async()=>fixture?.close());
function graph($){return JSON.parse($('script[type="application/ld+json"]').first().text())['@graph']}
test('static and dynamic bilingual homepages expose the same real FAQ content and discovery metadata',async()=>{
 for(const lang of ['ar','en'])for(const html of [fs.readFileSync(path.resolve(__dirname,`../dist/home-${lang}.html`),'utf8'),(await request(app).get('/'+lang+'/')).text]){
  const $=cheerio.load(html),nodes=graph($),faq=nodes.find(n=>n['@type']==='FAQPage');
  assert.equal($('h1').length,1);assert.equal(faq.mainEntity.length,4);
  faq.mainEntity.forEach((entry,i)=>{assert.equal($('.store-questions h3').eq(i).text(),entry.name);assert.equal($('.store-questions details p').eq(i).text(),entry.acceptedAnswer.text)});
  assert.equal($('link[hreflang="x-default"]').attr('href'),'https://mikyajkw.com/ar/');
  assert.equal($('meta[name="twitter:card"]').attr('content'),'summary_large_image');
  assert.equal($('link[rel=sitemap]').attr('href'),'/sitemap.xml');
  assert.ok($('a[href="/about.html?lang='+lang+'"]').length);
  const store=nodes.find(n=>Array.isArray(n['@type'])&&n['@type'].includes('LocalBusiness'));
  assert.equal(store.telephone,'+96566232231');assert.equal(store.openingHours,undefined);
 }
});
test('product breadcrumbs preserve product schema and About has a crawlable canonical page',async()=>{
 const response=await request(app).get('/en/products/rose-lipstick');const $=cheerio.load(response.text),nodes=graph($);
 assert.ok(nodes.find(n=>n['@type']==='Product'));
 const crumbs=nodes.find(n=>n['@type']==='BreadcrumbList').itemListElement;
 assert.equal(crumbs[0].item,'https://mikyajkw.com/en/');assert.equal(crumbs.at(-1).item,'https://mikyajkw.com/en/products/rose-lipstick');
 assert.equal($('nav[aria-label=Breadcrumb] [aria-current=page]').text(),crumbs.at(-1).name);
 const about=await request(app).get('/about.html?lang=en');assert.equal(about.status,200);const a=cheerio.load(about.text);
 assert.equal(a('link[rel=canonical]').attr('href'),'https://mikyajkw.com/about.html?lang=en');assert.match(a('main').text(),/Burhan al dahabi gen trad co/);
 assert.match((await request(app).get('/sitemap-pages.xml')).text,/about.html\?lang=en/);
});
test('journal exposes an actual publication date and organization byline in rendered HTML',async()=>{
 await fixture.db.query("INSERT INTO blog_posts(slug,title_ar,title_en,body_ar,body_en,status,publish_at) VALUES('seo-guide','دليل','Guide','نص','Body','PUBLISHED','2026-01-15T10:00:00Z')");
 const response=await request(app).get('/en/journal/seo-guide');const $=cheerio.load(response.text);
 assert.equal($('time').attr('datetime'),'2026-01-15T10:00:00.000Z');assert.match($('main').text(),/By Mikyaj Kuwait/);
 assert.equal(graph($).find(n=>n['@type']==='BlogPosting').datePublished,$('time').attr('datetime'));
});
