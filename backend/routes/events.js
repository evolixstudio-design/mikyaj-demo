const router=require('express').Router(),db=require('../db');
const {getSettings}=require('../services/commerce-settings');
router.post('/',require('../middleware/rate-limit')(120,60000),async(req,res,next)=>{try{
 if(!(await getSettings('events')).enabled||req.headers.dnt==='1'||req.headers['sec-gpc']==='1')return res.sendStatus(204);
 const b=req.body;if(!/^[a-f0-9-]{36}$/i.test(b.session_id||'')||!['page_view','product_view','search','add_to_cart','checkout_started'].includes(b.event)||typeof b.path!=='string'||!/^\/[a-zA-Z0-9_/.%\-]*$/.test(b.path)||b.path.length>250||b.path.startsWith('/admin')||!['mobile','tablet','desktop'].includes(b.device))return res.status(400).json({error:'Invalid event'});
 const productId=Number.isSafeInteger(b.product_id)&&b.product_id>0?b.product_id:null;
 await db.query('INSERT INTO commerce_events(session_id,customer_id,event,path,product_id,device) VALUES($1,$2,$3,$4,$5,$6)',[b.session_id,req.customer?.id||null,b.event,b.path,productId,b.device]);res.sendStatus(204);
 }catch(e){next(e)}});
module.exports=router;
