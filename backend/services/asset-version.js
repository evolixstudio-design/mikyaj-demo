const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=crypto.createHash('sha256');
function include(directory){for(const item of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){const file=path.join(directory,item.name);if(item.isDirectory())include(file);else if(/\.(js|mjs|css)$/.test(item.name))hash.update(item.name).update(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'));}}
for(const directory of ['js','css'])include(path.resolve(__dirname,'../../frontend/mikyaj-demo',directory));
const artwork=path.resolve(__dirname,'../../frontend/mikyaj-demo/assets/images/taxonomy');
if(fs.existsSync(artwork))for(const file of fs.readdirSync(artwork).sort())if(/\.webp$/.test(file))hash.update(file).update(fs.readFileSync(path.join(artwork,file)));
const heroArtwork=path.resolve(__dirname,'../../frontend/mikyaj-demo/assets/images');
for(const file of fs.readdirSync(heroArtwork).sort())if(/^hero-welcome-\d+\.webp$/.test(file))hash.update(file).update(fs.readFileSync(path.join(heroArtwork,file)));
module.exports=hash.digest('hex').slice(0,16);
