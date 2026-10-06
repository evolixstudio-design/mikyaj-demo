// Optimize reviewed source artwork and assign through authenticated admin APIs.
// Local-preview mutation only. A deployment must explicitly import the manifest later.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),manifestFile=path.join(root,'docs/taxonomy-artwork.json');
const output=path.join(root,'frontend/mikyaj-demo/assets/images/taxonomy');
async function run(){const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));fs.mkdirSync(output,{recursive:true});
 for(const entry of manifest){const destination=path.join(output,entry.file);if(!fs.existsSync(destination)){if(!entry.source_path||!fs.existsSync(entry.source_path))throw Error('Missing source '+entry.slug);await sharp(entry.source_path,{limitInputPixels:40000000}).rotate().resize({width:entry.kind==='category'?640:400,height:entry.kind==='category'?640:300,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toFile(destination)}entry.bytes=fs.statSync(destination).size;}
 fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
 if(!process.argv.includes('--preview'))return;
 const base='http://127.0.0.1:3101/api';let token;
 async function api(route,method='GET',body){const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw Error(route+': '+data.error);return data}
 token=(await api('/admin/auth/login','POST',{email:'admin@example.test',password:'TestPassword123!'})).token;
 for(const kind of ['category','brand']){const route=kind==='category'?'categories':'brands',rows=await api('/manage/'+route);for(const entry of manifest.filter(e=>e.kind===kind)){const row=rows.find(r=>r.slug===entry.slug);if(!row)throw Error('Missing taxonomy '+entry.slug);const image_url='/assets/images/taxonomy/'+entry.file;if(row.image_url&&row.image_url!==image_url){console.log('Preserved existing image: '+row.slug);continue;}await api('/manage/'+route+'/'+row.id,'PUT',{...row,name_en:row.name_en||row.name,image_url,image_alt_en:entry.alt_en,image_alt_ar:entry.alt_ar});console.log('Assigned '+entry.slug)}}
}
run().catch(e=>{console.error(e.message);process.exitCode=1});
