const router=require('express').Router(),{pool}=require('../db'),gateway=require('../services/myfatoorah');
async function applyPaymentDetails(client,details,paymentId){
 if(!details?.InvoiceId)throw new Error('INVALID_PROVIDER_RESPONSE');
 const p=(await client.query('SELECT * FROM payments WHERE provider_invoice_id=$1 FOR UPDATE',[String(details.InvoiceId)])).rows[0];if(!p)throw new Error('PAYMENT_NOT_FOUND');
 const o=(await client.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[p.order_id])).rows[0];if(!o)throw new Error('ORDER_NOT_FOUND');
 if(details.CustomerReference&&String(details.CustomerReference)!==o.order_number)throw new Error('PAYMENT_REFERENCE_MISMATCH');
 let status=p.status,next=o.status;const amount=Number(details.InvoiceValue);
 if(details.InvoiceStatus==='Paid'){
  if(!Number.isFinite(amount)||Math.round(amount*1000)!==Math.round(Number(o.total_amount)*1000))status='AMOUNT_MISMATCH';
  else{status='SUCCESS';if(o.status==='PENDING_PAYMENT')next='CONFIRMED'}
 }else if(p.status!=='SUCCESS'&&['Failed','Canceled'].includes(details.InvoiceStatus))status=details.InvoiceStatus.toUpperCase();
 // Once verified successful, a repeated or older event cannot undo payment or fulfilment.
 if(p.status==='SUCCESS')status='SUCCESS';
 await client.query('UPDATE payments SET status=$1,provider_payment_id=COALESCE($2,provider_payment_id),provider_reference=$3,updated_at=NOW() WHERE id=$4',[status,paymentId||null,details.InvoiceReference||null,p.id]);
 if(next!==o.status){await client.query('UPDATE orders SET status=$1,updated_at=NOW() WHERE id=$2',[next,o.id]);await client.query('INSERT INTO order_status_history(order_id,old_status,new_status,reason) VALUES($1,$2,$3,$4)',[o.id,o.status,next,'Payment verified by provider']);}
 return {order_number:o.order_number,payment_status:status,order_status:next};
}
async function processPaymentResult(client,paymentId){return applyPaymentDetails(client,await gateway.getPaymentStatus(paymentId,'PaymentId'),paymentId)}
router.get('/callback',require('../middleware/rate-limit')(30,60000),async(req,res)=>{const id=String(req.query.paymentId||'');if(!/^[a-zA-Z0-9-]{1,100}$/.test(id))return res.status(400).send('Invalid payment reference');let client;try{const details=await gateway.getPaymentStatus(id,'PaymentId');client=await pool.connect();await client.query('BEGIN');const result=await applyPaymentDetails(client,details,id);await client.query('COMMIT');res.redirect('/checkout-result.html?order='+encodeURIComponent(result.order_number));}catch(e){if(client)await client.query('ROLLBACK');console.error('Payment callback failed:',e.code||e.name);res.redirect('/checkout-result.html?error=true')}finally{client?.release()}});
router.processPaymentResult=processPaymentResult;router.applyPaymentDetails=applyPaymentDetails;module.exports=router;
