const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const myfatoorah = require('../services/myfatoorah');

// POST /api/webhook/myfatoorah
router.post('/myfatoorah', async (req, res) => {
  const signature = req.headers['myfatoorah-signature'];
  const secret = process.env.MYFATOORAH_WEBHOOK_SECRET;

  if (!signature) {
    return res.status(401).json({ error: 'Missing signature' });
  }

  // Verify signature
  const isValid = myfatoorah.verifyWebhookSignature(req.body, signature, secret);
  if (!isValid) {
    console.error('Webhook signature verification failed', req.body);
    return res.status(403).json({ error: 'Invalid signature' });
  }

  const eventType = req.body.Event; // e.g. "TransactionsStatusChanged" or "RefundStatusChanged"
  const eventData = req.body.Data; 

  if (!eventData || !eventData.InvoiceId) {
    // If there's no invoice ID, we can't tie it to an order. Just acknowledge.
    return res.status(200).send('OK');
  }

  const invoiceId = eventData.InvoiceId.toString();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if the payment exists
    const { rows: paymentRows } = await client.query(
      'SELECT id, order_id, status FROM payments WHERE provider_invoice_id = $1 FOR UPDATE',
      [invoiceId]
    );

    if (paymentRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(200).send('OK (Payment not found in this system)');
    }

    const payment = paymentRows[0];
    
    // ---------------------------------------------------------
    // Handle RefundStatusChanged
    // ---------------------------------------------------------
    if (eventType === 'RefundStatusChanged' || eventType === 'Refund_Status_Changed') {
      if (eventData.RefundId) {
        const refundIdStr = eventData.RefundId.toString();
        
        // Find existing refund by provider_refund_id
        const { rows: existingRefunds } = await client.query(
          'SELECT id, status FROM refunds WHERE provider_refund_id = $1 FOR UPDATE',
          [refundIdStr]
        );
        
        const newStatus = eventData.RefundStatus ? eventData.RefundStatus.toUpperCase() : 'UNKNOWN';
        
        if (existingRefunds.length > 0) {
          const refund = existingRefunds[0];
          // Update status if changed
          if (refund.status !== newStatus) {
            await client.query(
              'UPDATE refunds SET status = $1, provider_reference = COALESCE($2, provider_reference), updated_at = CURRENT_TIMESTAMP WHERE id = $3',
              [newStatus, eventData.RefundReference || null, refund.id]
            );
          }
        } else {
          // Unknown refund that we don't have locally but provider says exists.
          // Handle safely by inserting an "UNMATCHED" or "EXTERNAL" record, or just log.
          // We will insert it so reconciliation service can flag it.
          await client.query(`
            INSERT INTO refunds (order_id, payment_id, provider_refund_id, provider_reference, amount, currency, status, reason)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            payment.order_id, 
            payment.id, 
            refundIdStr, 
            eventData.RefundReference || null, 
            eventData.RefundAmount || 0,
            eventData.Currency || 'KWD',
            newStatus,
            'External Webhook / Unknown Local Origin'
          ]);
        }
      }
      
      await client.query('COMMIT');
      return res.status(200).send('OK');
    }
    
    // ---------------------------------------------------------
    // Handle TransactionsStatusChanged
    // ---------------------------------------------------------
    // We get the definitive status from GetPaymentStatus, rather than trusting the webhook payload implicitly.
    // The webhook just acts as a trigger to pull the truth.
    // However, the webhook usually passes PaymentId too if it's a TransactionsStatusChanged event.
    // If not, we can query by InvoiceId.
    const keyType = eventData.PaymentId ? 'PaymentId' : 'InvoiceId';
    const keyId = eventData.PaymentId || invoiceId;
    
    const details = await myfatoorah.getPaymentStatus(keyId, keyType);
    
    if (details && details.InvoiceStatus) {
      const mfStatus = details.InvoiceStatus;
      const mfTotal = parseFloat(details.InvoiceValue);
      const mfReference = details.InvoiceReference;
      
      const { rows: orderRows } = await client.query(
        'SELECT id, status, total_amount, order_number FROM orders WHERE id = $1 FOR UPDATE',
        [payment.order_id]
      );
      
      if (orderRows.length > 0) {
        const order = orderRows[0];
        let newPaymentStatus = payment.status;
        let newOrderStatus = order.status;

        if (mfStatus === 'Paid') {
          const expectedAmount = parseFloat(order.total_amount);
          if (Math.abs(expectedAmount - mfTotal) > 0.001) {
            newPaymentStatus = 'AMOUNT_MISMATCH';
          } else {
            newPaymentStatus = 'SUCCESS';
            newOrderStatus = 'CONFIRMED';
          }
        } else if (mfStatus === 'Failed' || mfStatus === 'Canceled') {
          newPaymentStatus = mfStatus.toUpperCase();
        }

        // Only update if something changed
        if (newPaymentStatus !== payment.status || (eventData.PaymentId && newPaymentStatus === payment.status)) {
           await client.query(`
            UPDATE payments 
            SET status = $1, provider_payment_id = $2, provider_reference = $3, updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
          `, [newPaymentStatus, eventData.PaymentId || null, mfReference, payment.id]);
        }

        if (newOrderStatus !== order.status) {
          await client.query(`
            UPDATE orders 
            SET status = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `, [newOrderStatus, order.id]);
        }
      }
    }
    
    await client.query('COMMIT');
    res.status(200).send('OK');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Webhook processing error:', error);
    res.status(500).send('Internal Error');
  } finally {
    client.release();
  }
});

module.exports = router;
