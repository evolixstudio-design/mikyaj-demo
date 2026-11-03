const {OAuth2Client}=require('google-auth-library');
const {getSettings}=require('./commerce-settings');
const client=new OAuth2Client();
async function clientId(){return process.env.GOOGLE_CLIENT_ID||(await getSettings('accounts')).google_client_id||''}
async function verify(credential,nonce,audience){
 const ticket=await client.verifyIdToken({idToken:credential,audience});const p=ticket.getPayload();
 if(!p?.sub||p.sub.length>255||p.email_verified!==true||p.nonce!==nonce||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email||''))throw Error('Invalid Google identity');
 return {sub:p.sub,email:p.email.toLowerCase(),name:String(p.name||p.email).slice(0,150)};
}
module.exports={clientId,verify};
