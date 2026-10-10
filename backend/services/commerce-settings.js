const crypto = require('node:crypto');
const db = require('../db');
const DEFAULTS = {
 delivery: {free_threshold:10,fee:1,enabled:true,areas:[],require_area_match:true},
 payments: {provider:'none',enabled:false,cod_enabled:true,mode:'sandbox'},
 social: {instagram:'https://www.instagram.com/mikyajkw/'},
 contact: {whatsapp:'96566232231',email:'',delivery_en:'',delivery_ar:'',returns_en:'',returns_ar:''}
};
async function getSettings(key, connection=db) {
 const {rows}=await connection.query('SELECT value FROM store_settings WHERE key=$1',[key]);
 const result={...(DEFAULTS[key]||{}),...(rows[0]?.value||{})};return key==='delivery'?require('./delivery-directory').completeDelivery(result):result;
}
async function setSettings(key,value,connection=db){
 await connection.query('INSERT INTO store_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()',[key,JSON.stringify(value)]);
}
function encryptionKey(){
 const value=process.env.SETTINGS_ENCRYPTION_KEY;
 if(!value||!(/^[a-f0-9]{64}$/i.test(value)))throw new Error('Set SETTINGS_ENCRYPTION_KEY to a 32-byte hex key on the server before saving credentials.');
 return Buffer.from(value,'hex');
}
async function saveSecret(name,value){
 if(!value) return;
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',encryptionKey(),iv);
 const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
 const payload=Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64');
 await db.query('INSERT INTO integration_secrets(name,ciphertext) VALUES($1,$2) ON CONFLICT(name) DO UPDATE SET ciphertext=EXCLUDED.ciphertext,updated_at=NOW()',[name,payload]);
}
async function getSecret(name){
 const {rows}=await db.query('SELECT ciphertext FROM integration_secrets WHERE name=$1',[name]);
 if(!rows[0])return process.env[name]||'';
 const payload=Buffer.from(rows[0].ciphertext,'base64');
 const cipher=crypto.createDecipheriv('aes-256-gcm',encryptionKey(),payload.subarray(0,12));
 cipher.setAuthTag(payload.subarray(12,28));
 return Buffer.concat([cipher.update(payload.subarray(28)),cipher.final()]).toString('utf8');
}
async function secretFlags(){const {rows}=await db.query('SELECT name FROM integration_secrets');return Object.fromEntries(['MYFATOORAH_API_KEY','MYFATOORAH_WEBHOOK_SECRET','GOOGLE_TRANSLATE_API_KEY'].map(k=>[k,rows.some(r=>r.name===k)||Boolean(process.env[k])]));}
async function audit(adminId,action,entityId,detail={},connection=db){await connection.query('INSERT INTO admin_audit_log(admin_id,action,entity_id,detail) VALUES($1,$2,$3,$4)',[adminId,action,String(entityId),JSON.stringify(detail)]);}
module.exports={getSettings,setSettings,saveSecret,getSecret,secretFlags,audit};
