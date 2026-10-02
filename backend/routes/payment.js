const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const myfatoorah = require('../services/myfatoorah');

// Generic helper to process payment status securely
async function processPaymentResult(client, paymentId) {
  // Call MyFatoorah to get the definitive payment details
  const details = await myfatoorah.getPaymentStatus(paymentId, 'PaymentId');
  
  if (!details || !details.InvoiceId) {
    throw new Error('Invalid payment details returned from MyFatoorah');
  }

  const invoiceId = details.InvoiceId.toString();
  const mfStatus = details.InvoiceStatus; // e.g., 'Paid', 'Failed', 'Pending'
  const mfReference = details.InvoiceReference;
  
  // A single Invoice might have multiple "InvoiceTransactions". 
  // For simplicity, we just use the top-level InvoiceStatus and total InvoiceValue.
  const mfTotal = parseFloat(details.InvoiceValue);

  // Retrieve the payment row
  const { rows: paymentRows } = await client.query(
    'SELECT * FROM payments WHERE provider_invoice_id = $1',
    [invoiceId]
  );

  if (paymentRows.length === 0) {
    throw new Error(`Payment record not found for invoice ID: ${invoiceId}`);
  }

  const payment = paymentRows[0];

  // Retrieve the order
  const { rows: orderRows } = await client.query(
    'SELECT * FROM orders WHERE id = $1 FOR UPDATE', // lock order for update
    [payment.order_id]
  );
  
  if (orderRows.length === 0) {
    throw new Error(`Order not found for payment ID: ${payment.id}`);
  }
  
  const order = orderRows[0];

  let newPaymentStatus = 'PENDING';
  let newOrderStatus = order.status;

  if (mfStatus === 'Paid') {
    // Crucial check: verify amount matches exactly what we expect
    const expectedAmount = parseFloat(order.total_amount);
    if (Math.abs(expectedAmount - mfTotal) > 0.001) {
      newPaymentStatus = 'AMOUNT_MISMATCH';
      newOrderStatus = 'PENDING_PAYMENT'; // Do NOT mark paid
      console.warn(`Amount mismatch on order ${order.order_number}: Expected ${expectedAmount}, Gateway reported ${mfTotal}`);
    } else {
      newPaymentStatus = 'SUCCESS';
      newOrderStatus = 'CONFIRMED';
    }
  } else if (mfStatus === 'Failed' || mfStatus === 'Canceled') {
    newPaymentStatus = mfStatus.toUpperCase(); // FAILED or CANCELED
    // Order remains in whatever state it was (e.g. PENDING_PAYMENT)
  }

  // Update payment record
  await client.query(`
    UPDATE payments 
    SET status = $1, provider_payment_id = $2, provider_reference = $3, updated_at = CURRENT_TIMESTAMP
    WHERE id = $4
  `, [newPaymentStatus, paymentId, mfReference, payment.id]);

  // Update order status if necessary
  if (newOrderStatus !== order.status) {
    await client.query(`
      UPDATE orders 
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [newOrderStatus, order.id]);
  }

  return {
    order_number: order.order_number,
    payment_status: newPaymentStatus,
    order_status: newOrderStatus
  };
}

// GET /api/payment/callback
// Typically MyFatoorah redirects back with ?paymentId=12345
router.get('/callback', async (req, res) => {
  const { paymentId } = req.query;
  if (!paymentId) {
    return res.status(400).send('Missing paymentId parameter');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await processPaymentResult(client, paymentId);
    await client.query('COMMIT');
    
    // Redirect to a frontend page with query params so frontend can display
    res.redirect(`/checkout-result.html?order=${result.order_number}&status=${result.payment_status}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Payment callback error:', error);
    res.redirect(`/checkout-result.html?error=true`);
  } finally {
    client.release();
  }
});

// GET /api/payment/status/:orderNumber
// Expose public safe status to the frontend
router.get('/status/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { rows } = await pool.query('SELECT status, total_amount FROM orders WHERE order_number = $1', [orderNumber]);
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    
    res.json({
      order_number: orderNumber,
      status: rows[0].status,
      total_amount: rows[0].total_amount
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve order status' });
  }
});

router.processPaymentResult = processPaymentResult;
module.exports = router;
