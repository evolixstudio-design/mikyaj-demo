const router=require('express').Router(),db=require('../db');
const {getSettings}=require('../services/commerce-settings');
router.post('/',require('../middleware/rate-limit')(120,60000),async(req,res,next)=>{try{
 if(!(await getSettings('events')).enabled||req.headers.dnt==='1'||req.headers['sec-gpc']==='1')return res.sendStatus(204);
 const b=req.body;if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(b.session_id||'')||!['page_view','page_dwell','product_view','search','add_to_cart','checkout_started'].includes(b.event)||typeof b.path!=='string'||!/^\/[a-zA-Z0-9_/.%\-]*$/.test(b.path)||b.path.length>250||/^\/(admin|api|driver)(?:\/|$)/.test(b.path)||!['mobile','tablet','desktop'].includes(b.device))return res.status(400).json({error:'Invalid event'});
 const productId=Number.isSafeInteger(b.product_id)&&b.product_id>0?b.product_id:null;
 const view=b.view_id||null;if(view&&!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(view))return res.status(400).json({error:'Invalid view'});
 if(b.event==='page_dwell'){if(!view||!Number.isInteger(b.duration_ms)||b.duration_ms<0||b.duration_ms>86400000)return res.status(400).json({error:'Invalid duration'});const exists=await db.query("SELECT id FROM commerce_events WHERE view_id=$1 AND session_id=$2 AND path=$3 AND event='page_view'",[view,b.session_id,b.path]);if(!exists.rows.length)return res.status(400).json({error:'Unknown page view'});await db.query("INSERT INTO commerce_events(session_id,customer_id,event,path,device,view_id,duration_ms) VALUES($1,$2,'page_dwell',$3,$4,$5,$6) ON CONFLICT(view_id) WHERE event='page_dwell' DO UPDATE SET duration_ms=GREATEST(commerce_events.duration_ms,EXCLUDED.duration_ms) WHERE commerce_events.session_id=EXCLUDED.session_id AND commerce_events.path=EXCLUDED.path",[b.session_id,req.customer?.id||null,b.path,b.device,view,b.duration_ms]);}
 else await db.query('INSERT INTO commerce_events(session_id,customer_id,event,path,product_id,device,view_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[b.session_id,req.customer?.id||null,b.event,b.path,productId,b.device,view]);res.sendStatus(204);
 }catch(e){next(e)}});
module.exports=router;
