const jwt=require('jsonwebtoken');
const db=require('../db');
function token(req){const match=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('mikyaj_customer='));return match?decodeURIComponent(match.slice(16)):null;}
const secret=()=>process.env.CUSTOMER_JWT_SECRET||process.env.ADMIN_JWT_SECRET;
async function optionalCustomer(req,res,next){
 try{const value=token(req);if(!value)return next();const payload=jwt.verify(value,secret(),{audience:'mikyaj-customer'});if(payload.role!=='CUSTOMER')return next();const {rows}=await db.query("SELECT id,name,email,phone,session_version FROM customers WHERE id=$1 AND status='ACTIVE'",[payload.id]);if(rows[0]&&rows[0].session_version===payload.version)req.customer=rows[0];}catch(e){if(e instanceof URIError)return next();if(!['JsonWebTokenError','TokenExpiredError','NotBeforeError'].includes(e.name))return next(e)}next();
}
function requireCustomer(req,res,next){if(!req.customer)return res.status(401).json({error:'Please sign in.'});next();}
function setSession(res,customer){if(!secret())throw new Error('Customer authentication is not configured');const value=jwt.sign({id:customer.id,role:'CUSTOMER',version:customer.session_version},secret(),{expiresIn:'7d',audience:'mikyaj-customer'});res.cookie('mikyaj_customer',value,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:7*86400000,path:'/'});}
module.exports={optionalCustomer,requireCustomer,setSession};
