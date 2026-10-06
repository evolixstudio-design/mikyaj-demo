// Local preview only. Does not load .env or access production credentials.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
if(!process.argv.includes('--preview'))throw Error('Pass --preview to explicitly target the isolated local database.');
const base='http://127.0.0.1:3101/api',file=path.resolve('translation-output/descriptions-machine.jsonl'),ledger=path.resolve('.local-test-data/descriptions-imported.json');
let saved=[];try{saved=JSON.parse(fs.readFileSync(ledger,'utf8'))}catch{}const done=new Set(saved);let token;
async function api(route,body){const response=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw Error(data.error||response.status);return data}
(async()=>{token=(await api('/admin/auth/login',{email:'admin@example.test',password:'TestPassword123!'})).token;let failures=0;
 do{try{const lines=fs.existsSync(file)?fs.readFileSync(file,'utf8').split('\n').filter(Boolean):[];const pending=[];for(const line of lines){let record;try{record=JSON.parse(line)}catch{continue}const key=crypto.createHash('sha256').update(line).digest('hex');if(!done.has(key))pending.push({key,record})}
 for(let i=0;i<pending.length;i+=100){const batch=pending.slice(i,i+100),result=await api('/manage/translations/import',{products:batch.map(p=>p.record)});batch.forEach(p=>done.add(p.key));fs.writeFileSync(ledger+'.tmp',JSON.stringify([...done]));fs.renameSync(ledger+'.tmp',ledger);console.log(JSON.stringify({processed:done.size,...result}));}failures=0;
 const source=JSON.parse(fs.readFileSync('.local-test-data/current-description-source.json','utf8'));if(done.size>=source.length)break;
 }catch(error){console.error(error.message);if(++failures>=3)throw error}
 if(!process.argv.includes('--watch'))break;await new Promise(r=>setTimeout(r,5000));
 }while(true);
})().catch(error=>{console.error(error.message);process.exitCode=1});
