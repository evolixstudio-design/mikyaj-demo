const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=crypto.createHash('sha256');
function include(directory){for(const item of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){const file=path.join(directory,item.name);if(item.isDirectory())include(file);else if(/\.(js|css)$/.test(item.name))hash.update(item.name).update(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'));}}
for(const directory of ['js','css'])include(path.resolve(__dirname,'../../frontend/mikyaj-demo',directory));
module.exports=hash.digest('hex').slice(0,16);
