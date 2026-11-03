const router=require('express').Router(),crypto=require('node:crypto'),bcrypt=require('bcryptjs'),db=require('../db');
const google=require('../services/google-signin'),{setSession}=require('../middleware/customer-auth'),{getSettings}=require('../services/commerce-settings');
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
const cookieOptions=()=>({httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/api/customer/google',maxAge:600000});
router.get('/google/config',wrap(async(req,res)=>{const client_id=await google.clientId();if(!client_id)return res.json({enabled:false});const nonce=crypto.randomBytes(32).toString('base64url');res.cookie('mikyaj_google_nonce',nonce,cookieOptions());res.json({enabled:true,client_id,nonce})}));
router.post('/google',require('../middleware/rate-limit')(15,600000),wrap(async(req,res)=>{
 const clientId=await google.clientId();if(!clientId)return res.status(503).json({error:'Google sign-in is not connected yet.'});
 const nonce=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('mikyaj_google_nonce='))?.slice('mikyaj_google_nonce='.length);
 res.clearCookie('mikyaj_google_nonce',{path:'/api/customer/google'});
 if(!/^[A-Za-z0-9_-]{43}$/.test(nonce||'')||req.body.nonce!==nonce||typeof req.body.credential!=='string'||req.body.credential.length>12000)return res.status(401).json({error:'Refresh the page and try Google sign-in again.'});
 let identity;try{identity=await google.verify(req.body.credential,nonce,clientId)}catch{return res.status(401).json({error:'Google sign-in could not be verified. Try again.'})}
 if(req.customer&&req.customer.email!==identity.email)return res.status(409).json({error:'Use Google with the same email to connect your account, or sign out before switching accounts.'});
 const client=await db.pool.connect();try{await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['google:'+identity.sub]);
  let c=(await client.query('SELECT * FROM customers WHERE google_sub=$1 FOR UPDATE',[identity.sub])).rows[0];
  if(!c){const existing=(await client.query('SELECT * FROM customers WHERE email=$1 FOR UPDATE',[identity.email])).rows[0];
   // Never link a previously unverified password account merely because its email matches.
   if(existing){if(req.customer?.id!==existing.id){await client.query('ROLLBACK');return res.status(409).json({error:'This email already has an account. Sign in with your password first, then connect Google from your profile.'})}if(existing.google_sub&&existing.google_sub!==identity.sub){await client.query('ROLLBACK');return res.status(409).json({error:'This account is already connected to another Google identity.'})}c=(await client.query('UPDATE customers SET google_sub=$1 WHERE id=$2 RETURNING *',[identity.sub,existing.id])).rows[0];}
   else {if((await getSettings('accounts',client)).registration_enabled===false){await client.query('ROLLBACK');return res.status(403).json({error:'New account registration is currently closed.'})}c=(await client.query('INSERT INTO customers(email,name,phone,password_hash,google_sub) VALUES($1,$2,$3,$4,$5) RETURNING *',[identity.email,identity.name,'',await bcrypt.hash(crypto.randomBytes(40).toString('base64url'),12),identity.sub])).rows[0];}
  }
  if(c.status!=='ACTIVE'){await client.query('ROLLBACK');return res.status(403).json({error:'This customer account is inactive.'})}
  await client.query('COMMIT');setSession(res,c);res.json({customer:{id:c.id,name:c.name,email:c.email,phone:c.phone}});
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}));
module.exports=router;
