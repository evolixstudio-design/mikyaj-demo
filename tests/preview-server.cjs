const {setup}=require('./isolated-db.cjs');
const path=require('node:path');
const catalog=process.argv.includes('--catalog'),persistent=process.argv.includes('--persistent');
setup({dataDir:persistent?path.resolve(__dirname,'../.local-test-data/admin-preview-db'):undefined}).then(async fixture=>{
 if(catalog){
  const loaded=(await fixture.db.query("SELECT value FROM store_settings WHERE key='preview_catalog_loaded'")).rows[0];
  if(!loaded){await require('./load-preview-catalog.cjs')(fixture);await fixture.db.query("INSERT INTO store_settings(key,value) VALUES('preview_catalog_loaded','{\"loaded\":true}')");}
  process.env.FRONTEND_URL='http://127.0.0.1:3101';
 }
 if(!process.env.TRANSLATION_URL){try{const response=await fetch('http://127.0.0.1:8765/health',{signal:AbortSignal.timeout(800)});if(response.ok)process.env.TRANSLATION_URL='http://127.0.0.1:8765'}catch{}}
 const app=require('../backend/app').createApp({localPreview:true});
 const server=app.listen(catalog?3101:3100,'127.0.0.1',()=>console.log(`Isolated ${persistent?'persistent':'temporary'} preview: http://127.0.0.1:${catalog?3101:3100} · admin@example.test / TestPassword123! · test data only`));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(async()=>{await fixture.close();process.exit()}));
}).catch(e=>{console.error(e);process.exitCode=1});
