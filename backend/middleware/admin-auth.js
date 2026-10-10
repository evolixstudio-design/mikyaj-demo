const jwt=require('jsonwebtoken');
const db=require('../db');
const PERMISSIONS=['products','orders','customers','discounts','content','analytics','settings','translations','returns'];
function resource(req){
 const path=req.originalUrl.split('?')[0];
 if(/\/users(?:\/|$)/.test(path))return 'users';
 if(/\/settings(?:\/|$)/.test(path))return 'settings';
 if(/\/refunds(?:\/|$)|\/cash(?:\/|$)/.test(path))return 'refunds';
 if(/\/orders(?:\/|$)/.test(path))return 'orders';
 if(/\/returns(?:\/|$)/.test(path))return 'returns';
 if(/\/content(?:\/|$)/.test(path))return 'content';
 if(/\/(products|categories|brands|images|product-views|product-fields)(?:\/|$)/.test(path))return 'products';
 if(/\/(offers|discounts)(?:\/|$)/.test(path))return 'discounts';
 if(/\/(translations|translate)(?:\/|$)/.test(path))return 'translations';
 if(/\/customers(?:\/|$)/.test(path))return 'customers';
 if(/\/posts(?:\/|$)|\/content(?:\/|$)/.test(path))return 'content';
 if(/\/(dashboard|analytics|page-visits)(?:\/|$)/.test(path))return 'analytics';
 if(/\/settings(?:\/|$)/.test(path))return 'settings';
 return null;
}
async function requireAdminAuth(req,res,next){
 const token=(req.headers.authorization||'').match(/^Bearer (.+)$/)?.[1];if(!token)return res.status(401).json({error:'Please sign in.'});
 let payload;try{payload=jwt.verify(token,process.env.ADMIN_JWT_SECRET);if(!['ADMIN','SUPER_ADMIN','STAFF'].includes(payload.role)||payload.aud==='mikyaj-customer')throw Error('Wrong token purpose')}catch{return res.status(401).json({error:'Your session expired. Please sign in.'})}
 try{
 const row=(await db.query("SELECT id,email,name,role,status,permissions,session_version FROM admin_users WHERE id=$1 AND status='ACTIVE'",[payload.id])).rows[0];
 if(!row||!['SUPER_ADMIN','ADMIN','STAFF'].includes(row.role)||Number(payload.session_version||0)!==row.session_version)return res.status(401).json({error:'Your account or session is no longer active.'});
 const permission=resource(req);
 if(permission==='users'&&row.role!=='SUPER_ADMIN')return res.status(403).json({error:'Only the store owner can manage staff.'});
 if(row.role==='STAFF'&&permission&&!(Array.isArray(row.permissions)&&row.permissions.includes(permission)))return res.status(403).json({error:'Your staff account does not have permission for this action.'});
 req.admin=row;next();
 }catch(error){next(error)}
}
module.exports={requireAdminAuth,PERMISSIONS};
