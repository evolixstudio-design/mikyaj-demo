const router=require('express').Router(),{pool}=require('../db'),gateway=require('../services/myfatoorah'),{getSecret}=require('../services/commerce-settings');
router.post('/myfatoorah',async(req,res,next)=>{let client;try{
 const secret=await getSecret('MYFATOORAH_WEBHOOK_SECRET');if(!gateway.verifyWebhookSignature(req.body,req.headers['myfatoorah-signature'],secret))return res.status(403).json({error:'Invalid signature'});
 const v2=typeof req.body.Event==='object',data=req.body.Data,event=v2?req.body.Event.Name:req.body.Event;
 if(['PAYMENT_STATUS_CHANGED','TransactionsStatusChanged'].includes(event)){
  const invoice=v2?data.Invoice?.Id:data.InvoiceId,paymentId=v2?data.Transaction?.PaymentId:data.PaymentId;if(!invoice)return res.status(400).json({error:'Missing invoice'});
  const details=await gateway.getPaymentStatus(paymentId||String(invoice),paymentId?'PaymentId':'InvoiceId');if(String(details.InvoiceId)!==String(invoice))return res.status(400).json({error:'Invoice mismatch'});
  client=await pool.connect();await client.query('BEGIN');await require('./payment').applyPaymentDetails(client,details,paymentId);await client.query('COMMIT');
 }else if(['REFUND_STATUS_CHANGED','RefundStatusChanged'].includes(event)){
  const invoice=v2?data.ReferencedInvoice?.Id:data.InvoiceId,id=v2?data.Refund?.Id:data.RefundId,status=v2?data.Refund?.Status:data.RefundStatus,amount=Number(v2?data.Amount?.ValueInBaseCurrency:data.Amount);if(!['REFUNDED','CANCELED'].includes(status)||!Number.isFinite(amount))return res.status(400).json({error:'Invalid refund'});
  client=await pool.connect();await client.query('BEGIN');
  const refund=(await client.query('SELECT r.* FROM refunds r JOIN payments p ON p.id=r.payment_id WHERE r.provider_refund_id=$1 AND p.provider_invoice_id=$2 FOR UPDATE OF r',[String(id),String(invoice)])).rows[0];
  if(!refund||Math.round(Number(refund.amount)*1000)!==Math.round(amount*1000))throw new Error('REFUND_REQUIRES_RECONCILIATION');
  if(refund.status!=='REFUNDED')await client.query('UPDATE refunds SET status=$1,updated_at=NOW() WHERE id=$2',[status,refund.id]);await client.query('COMMIT');
 }
 res.json({received:true});
 }catch(e){if(client)await client.query('ROLLBACK');next(e)}finally{client?.release()}});module.exports=router;
