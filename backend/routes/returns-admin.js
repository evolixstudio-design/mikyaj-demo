const router=require('express').Router(),db=require('../db');
const {fail}=require('../services/commerce-quote');
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
router.get('/returns/:id',wrap(async(req,res)=>{const r=(await db.query('SELECT r.*,o.order_number,o.customer_name,o.customer_phone FROM return_requests r JOIN orders o ON o.id=r.order_id WHERE r.id=$1',[Number(req.params.id)||0])).rows[0];if(!r)fail('Return not found',404);res.json({return:r,evidence:(await db.query('SELECT id FROM return_evidence WHERE return_id=$1',[r.id])).rows,history:(await db.query('SELECT status,note,created_at FROM return_history WHERE return_id=$1 ORDER BY id',[r.id])).rows})}));
router.get('/returns/:id/evidence/:image',wrap(async(req,res)=>{if(!/^[a-f0-9-]{36}$/i.test(req.params.image))fail('Photo not found',404);const photo=(await db.query('SELECT image FROM return_evidence WHERE id=$1 AND return_id=$2',[req.params.image,Number(req.params.id)||0])).rows[0];if(!photo)fail('Photo not found',404);res.set('Cache-Control','private,no-store').type('webp').send(Buffer.from(photo.image))}));
module.exports=router;
