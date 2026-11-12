// Per-process protection; use an edge/shared rate limit for multi-instance deployments.
const crypto=require('node:crypto');
function rateLimit(limit=20,windowMs=60000,keyFor=req=>req.ip){const buckets=new Map();let calls=0;return(req,res,next)=>{const now=Date.now();if(++calls%100===0)for(const[k,v]of buckets)if(v.until<now)buckets.delete(k);const key=String(keyFor(req)||'unknown');let b=buckets.get(key);if(!b||b.until<now){b={count:0,until:now+windowMs};buckets.set(key,b)}if(++b.count>limit){res.set('Retry-After',String(Math.ceil((b.until-now)/1000)));return res.status(429).json({error:'Too many requests. Please try again shortly.'})}next()}}

// Authentication limits must not use a shared proxy/server IP as the only key.
// Hash the normalized account identifier so it is not retained in the in-memory map.
rateLimit.emailKey=scope=>req=>{const email=String(req.body?.email||'').trim().toLowerCase().slice(0,254);return `${scope}:${crypto.createHash('sha256').update(email).digest('hex')}`};

module.exports=rateLimit;
