const router=require('express').Router();
const crypto=require('node:crypto');
const db=require('../db');
const {getSettings}=require('../services/commerce-settings');
const {quote,normalizeItems,phone,address,fail}=require('../services/commerce-quote');
const gateway=require('../services/myfatoorah');
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
function trackingToken(order,key){const secret=process.env.ORDER_TRACKING_SECRET||process.env.ADMIN_JWT_SECRET;if(!secret)throw new Error('Order tracking is not configured');return crypto.createHmac('sha256',secret).update(order+':'+key).digest('hex');}
router.post('/',require('../middleware/rate-limit')(15,60000),async(req,res,next)=>{
 let client;let order,paymentId,token;
 try{
 res.set('Cache-Control','no-store');const b=req.body;
 if(typeof b.idempotencyKey!=='string'||!/^[a-zA-Z0-9-]{20,100}$/.test(b.idempotencyKey))fail('Invalid checkout key.');
 const customer=b.customer||{},name=String(customer.name||'').trim().slice(0,150);if(!name)fail('Your name is required.');
 const customerPhone=phone(customer.phone),deliveryAddress=address(customer.address);
 const email=String(customer.email||'').trim().toLowerCase();if(email&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254))fail('Invalid email.');
 const items=normalizeItems(b.items),method=b.payment_method;
 const payments=await getSettings('payments');
 if(method==='COD'){if(!payments.cod_enabled)fail('Cash on delivery is unavailable.',409);}
 else if(method!=='MYFATOORAH'||!payments.enabled||payments.provider!=='myfatoorah')fail('This payment method is not connected.',409);
 const fingerprint=sha(JSON.stringify({items,name,phone:customerPhone,address:deliveryAddress,email,method,customer_id:req.customer?.id||null}));
 client=await db.pool.connect();await client.query('BEGIN');
 await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[b.idempotencyKey]);
 order=(await client.query('SELECT * FROM orders WHERE idempotency_key=$1 FOR UPDATE',[b.idempotencyKey])).rows[0];
 if(order&&order.checkout_fingerprint!==fingerprint)fail('Your bag or details changed. Refresh checkout and try again.',409);
 if(!order){
 await client.query('SELECT id FROM products WHERE id=ANY($1::int[]) ORDER BY id FOR SHARE',[items.map(i=>i.productId)]);
 const totals=await quote(items,client,deliveryAddress.area);if(!totals.delivery_available)fail('Delivery to this area needs confirmation. Please contact the store or choose a configured area.',409);
 const number='MKJ-'+crypto.randomBytes(8).toString('hex').toUpperCase();token=trackingToken(number,b.idempotencyKey);
 order=(await client.query('INSERT INTO orders(order_number,customer_name,customer_phone,customer_address,customer_email,total_amount,subtotal,delivery_fee,status,payment_method,idempotency_key,customer_id,tracking_token_hash,checkout_fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *',[number,name,customerPhone,JSON.stringify(deliveryAddress),email||null,totals.total,totals.subtotal,totals.delivery_fee,method==='COD'?'CONFIRMED':'PENDING_PAYMENT',method,b.idempotencyKey,req.customer?.id||null,sha(token),fingerprint])).rows[0];
 for(const item of totals.items)await client.query('INSERT INTO order_items(order_id,product_id,quantity,price_at_purchase,product_name_ar,product_name_en) VALUES($1,$2,$3,$4,$5,$6)',[order.id,item.productId,item.qty,item.price,item.name_ar,item.name_en]);
 await client.query('INSERT INTO order_status_history(order_id,new_status,reason) VALUES($1,$2,$3)',[order.id,order.status,method==='COD'?'Cash on delivery order received':'Awaiting verified payment']);
 }
 token=token||trackingToken(order.order_number,b.idempotencyKey);
 const response={success:true,order:{order_number:order.order_number,status:order.status,total_amount:order.total_amount},tracking_token:token};
 if(method==='COD'){await client.query('COMMIT');return res.status(201).json({...response,payment:{status:'UNPAID',method:'COD'}});}
 if(order.status!=='PENDING_PAYMENT'){await client.query('COMMIT');return res.json({...response,payment:{status:order.status==='CANCELLED'?'CANCELLED':'SUCCESS'}});}
 const pending=(await client.query("SELECT * FROM payments WHERE order_id=$1 AND status='PENDING' ORDER BY id DESC LIMIT 1",[order.id])).rows[0];
 if(pending){if(pending.raw_reference){await client.query('COMMIT');return res.json({...response,payment:{status:'PENDING',redirect_url:pending.raw_reference}});}fail('A payment attempt is still being checked. Please wait before trying again.',409);}
 paymentId=(await client.query("INSERT INTO payments(order_id,provider,status,amount,currency) VALUES($1,'MYFATOORAH','PENDING',$2,'KWD') RETURNING id",[order.id,order.total_amount])).rows[0].id;
 await client.query('COMMIT');client.release();client=null;
 try{
 const data=await gateway.initiatePayment({invoiceAmount:order.total_amount,orderId:order.order_number,customerName:name,customerPhone,customerEmail:email});
 const redirect=new URL(data.InvoiceURL);if(redirect.protocol!=='https:')throw new Error('Invalid payment URL');
 await db.query('UPDATE payments SET provider_invoice_id=$1,raw_reference=$2 WHERE id=$3',[String(data.InvoiceId),redirect.href,paymentId]);
 res.status(201).json({...response,payment:{status:'PENDING',redirect_url:redirect.href}});
 }catch(e){
 // Unknown network outcomes remain pending to prevent duplicate remote invoices.
 if(e.definitive)await db.query("UPDATE payments SET status='FAILED',updated_at=NOW() WHERE id=$1",[paymentId]);
 res.status(502).json({error:'Your order is saved. Payment could not be confirmed; check the order before retrying.',order:response.order,tracking_token:token});
 }
 }catch(e){if(client)await client.query('ROLLBACK');next(e)}finally{if(client)client.release()}
});
module.exports=router;
