const express=require('express'),compression=require('compression'),path=require('node:path');
const {optionalCustomer}=require('./middleware/customer-auth');
const {requireAdminAuth}=require('./middleware/admin-auth');
function createApp({localPreview=false}={}){const preview=localPreview&&process.env.NODE_ENV==='test';const app=express();app.disable('x-powered-by');if(process.env.TRUST_PROXY==='1')app.set('trust proxy',1);app.use(compression({threshold:1024}));
app.use((req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','X-Frame-Options':preview?'SAMEORIGIN':'DENY','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()'});next()});
app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');if(['GET','HEAD','OPTIONS'].includes(req.method)||req.path.startsWith('/webhook'))return next();const origin=req.headers.origin;const allowed=[process.env.FRONTEND_URL||'https://mikyajkw.com','https://mikyajkw.com',...(process.env.NODE_ENV==='production'?[]:['http://localhost:3000','http://127.0.0.1:3000','http://127.0.0.1:3100'])];if(origin&&!allowed.includes(origin))return res.status(403).json({error:'Request origin is not allowed.'});if(req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({error:'Cross-site request rejected.'});if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return res.status(415).json({error:'Use JSON for this request.'});next()});
app.use(express.json({limit:'6mb'}));app.use('/api',optionalCustomer);
for(const [route,file]of Object.entries({health:'health',products:'products',categories:'categories',brands:'brands',checkout:'checkout',webhook:'webhook',store:'store',customer:'customer',manage:'manage'}))app.use('/api/'+route,require('./routes/'+file));
app.use('/api/admin/auth',require('./middleware/rate-limit')(20,600000),require('./routes/admin-auth'));
app.use('/api/admin/orders',requireAdminAuth,require('./routes/admin-orders'));app.use('/api/admin',require('./routes/admin-refunds'));
// Order details are available only through an authenticated account or private tracking token.
app.get('/api/payment/status/:number',(req,res)=>res.status(410).json({error:'Use the private order tracking page.'}));app.use('/api/payment',require('./routes/payment'));
app.use('/api',(req,res)=>res.status(404).json({error:'API route not found.'}));
if(preview)app.get('/__preview/mobile',(req,res)=>res.sendFile(path.resolve(__dirname,'../tests/preview-mobile.html')));
app.use(require('./routes/seo'));
const root=path.resolve(__dirname,'../',process.env.SERVE_DIST==='1'?'dist':'frontend/mikyaj-demo');
app.get(['/admin','/admin/','/admin/login'],(req,res)=>res.redirect('/admin/login.html'));
app.get(/^\/admin\/(?!login\.html$|manage\.html$).+\.html$/,(req,res)=>res.redirect('/admin/manage.html'));
app.use(express.static(root,{index:'index.html',dotfiles:'deny',setHeaders(res,file){if(/\.(js|css|webp|png|svg)$/.test(file))res.set('Cache-Control',/\.(js|css)$/.test(file)?'public,max-age=0,must-revalidate':'public,max-age=86400')}}));
app.use((req,res)=>res.status(404).type('html').send(require('./views/storefront').shell({title:'Page not found / الصفحة غير موجودة',robots:'noindex,follow',content:'<div class="container section"><h1>404</h1><p>Page not found / الصفحة غير موجودة</p><a href="/">Return to Mikyaj / العودة للمتجر</a></div>'})));
app.use((err,req,res,next)=>{if(res.headersSent)return next(err);let status=Number(err.status)||500;if(err.code==='23505')status=409;if(err.code==='23503')status=400;const message=status>=500?'Something went wrong. Please try again.':err.code==='23505'?'This record already exists.':err.code==='23503'?'The related record does not exist.':err.message;if(status>=500)console.error('Request failed:',req.method,req.path,err.code||err.name);res.status(status).json({error:message})});return app;}
module.exports={createApp};
