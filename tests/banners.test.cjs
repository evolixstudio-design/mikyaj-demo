const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),request=require('supertest'),sharp=require('sharp');
let fixture,app,admin,revision=0,id,image;
const draft=()=>({placement:'hero',kind:'seasonal',fit:'contain',link_url:'/shop.html?offers=true',title_en:'Beauty edit <script>',title_ar:'اختيارات الجمال',image_alt_en:'Makeup products on a pale background',image_alt_ar:'منتجات مكياج على خلفية فاتحة',seo_description_en:'Explore makeup and skincare at Mikyaj Kuwait.',seo_description_ar:'تصفحي المكياج والعناية بالبشرة في مكياج الكويت.',image_url:image.url,image_width:image.width,image_height:image.height,focus_x:50,focus_y:50,priority:1});
before(async()=>{fixture=await require('./isolated-db.cjs').setup();app=require('../backend/app').createApp({localPreview:true});const login=await request(app).post('/api/admin/auth/login').send({email:'admin@example.test',password:'TestPassword123!'});admin={Authorization:'Bearer '+login.body.token};});
after(async()=>fixture?.close());
test('banner uploads are authenticated, retain ratio and work for content-only staff',async()=>{
 assert.equal((await request(app).get('/api/manage/content/banners')).status,401);
 const png=await sharp({create:{width:1600,height:700,channels:3,background:'#edc9bd'}}).png().toBuffer(),data='data:image/png;base64,'+png.toString('base64');
 assert.equal((await request(app).post('/api/manage/content/images').send({data})).status,401);
 const hash=await require('bcryptjs').hash('StaffPassword123!',4);await fixture.db.query("INSERT INTO admin_users(email,password_hash,role,permissions) VALUES('content@example.test',$1,'STAFF','[\"content\"]')",[hash]);
 const login=(await request(app).post('/api/admin/auth/login').send({email:'content@example.test',password:'StaffPassword123!'})).body;
 const staff={Authorization:'Bearer '+login.token};assert.equal((await request(app).get('/api/manage/products').set(staff)).status,403);
 const result=await request(app).post('/api/manage/content/images').set(staff).send({data});assert.equal(result.status,200,JSON.stringify(result.body));image=result.body;assert.equal(image.width,1600);assert.equal(image.height,700);
 assert.equal((await request(app).get('/api/manage/content/banners').set(staff)).status,200);
 assert.equal((await request(app).post('/api/manage/content/images').set(admin).send({data:'data:image/png;base64,AAAA'})).status,400);
});
test('drafts stay private; publish changes live configuration and bilingual server-rendered hero SEO without a build',async()=>{
 const created=await request(app).post('/api/manage/content/banners').set(admin).send({...draft(),revision});assert.equal(created.status,201,JSON.stringify(created.body));id=created.body.banner.id;revision=created.body.revision;
 assert.equal((await request(app).get('/api/store/config')).body.banners.length,0);
 assert.doesNotMatch((await request(app).get('/en/')).text,/data-banner-id=/);
 const published=await request(app).post('/api/manage/content/banners/'+id+'/publish').set(admin).send({revision});assert.equal(published.status,200,JSON.stringify(published.body));revision=published.body.revision;
 const config=(await request(app).get('/api/store/config')).body;assert.equal(config.banners[0].id,id);assert.equal(config.banners[0].draft,undefined);assert.equal(config.banners[0].published,undefined);
 for(const [lang,title,desc]of [['en','Beauty edit &lt;script&gt;',draft().seo_description_en],['ar',draft().title_ar,draft().seo_description_ar]]){const home=await request(app).get('/'+lang+'/');assert.match(home.text,new RegExp('data-banner-id="'+id+'"'));assert.ok(home.text.includes(title));assert.ok(home.text.includes('name="description" content="'+desc+'"'));assert.ok(home.text.includes('offers=true&amp;lang='+lang));assert.doesNotMatch(home.text,/<script>Beauty/);}
 const saved=await request(app).put('/api/manage/content/banners/'+id).set(admin).send({...draft(),title_en:'Private unreleased draft',revision});assert.equal(saved.status,200);revision=saved.body.revision;
 assert.notEqual((await request(app).get('/api/store/config')).body.banners[0].title_en,'Private unreleased draft');
 assert.doesNotMatch((await request(app).get('/en/')).text,/Private unreleased draft/);
});
test('optimistic revisions prevent lost changes; validation rejects unsafe links and missing bilingual alt text',async()=>{
 assert.equal(require('../backend/services/storefront-banners').safeLink('https://mikyajkw.com/en/products/rose-lipstick'),'/en/products/rose-lipstick');
 assert.equal((await request(app).put('/api/manage/content/banners/'+id).set(admin).send({...draft(),revision:0})).status,409);
 for(const link_url of ['javascript:alert(1)','//evil.example','/admin/manage.html'])assert.equal((await request(app).put('/api/manage/content/banners/'+id).set(admin).send({...draft(),link_url,revision})).status,400);
 const changed=await request(app).put('/api/manage/content/banners/'+id).set(admin).send({...draft(),image_alt_ar:'',revision});assert.equal(changed.status,200);revision=changed.body.revision;
 assert.equal((await request(app).post('/api/manage/content/banners/'+id+'/publish').set(admin).send({revision})).status,400);
 assert.ok((await request(app).get('/api/store/config')).body.banners[0].image_alt_ar);
});
test('only one hero is published; unpublish restores the welcome artwork and keeps designs editable',async()=>{
 const next=await request(app).post('/api/manage/content/banners').set(admin).send({...draft(),title_en:'New hero',revision});assert.equal(next.status,201);revision=next.body.revision;const second=next.body.banner.id;
 const published=await request(app).post('/api/manage/content/banners/'+second+'/publish').set(admin).send({revision});assert.equal(published.status,200);revision=published.body.revision;
 assert.equal((await request(app).get('/api/store/config')).body.banners.filter(b=>b.placement==='hero').length,1);
 const unpublished=await request(app).post('/api/manage/content/banners/'+second+'/unpublish').set(admin).send({revision});assert.equal(unpublished.status,200);revision=unpublished.body.revision;
 assert.equal((await request(app).get('/api/store/config')).body.banners.length,0);const html=(await request(app).get('/en/')).text;assert.match(html,/hero-welcome-1600\.webp/);assert.doesNotMatch(html,/class="hero-copy"|class="hero-photo"|class="campaign-ribbon"/);assert.match(html,/data-banner-slot="after_categories"/);
 assert.equal((await request(app).get('/api/manage/content/banners').set(admin)).body.items.length,2);
 assert.equal((await request(app).get('/en/?content_admin=1')).text.includes('name="robots" content="noindex,nofollow"'),true);
 const removed=await request(app).delete('/api/manage/content/banners/'+second).set(admin).send({revision});assert.equal(removed.status,200);
});
