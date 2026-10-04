const { pool } = require('../db');
const myfatoorah = require('./myfatoorah');

/**
 * Creates a refund request
 * @param {Object} params
 */
async function requestRefund({ orderId, paymentId, amount, reason, adminId, idempotencyKey }) {
  // Validate input
  const refundAmount = parseFloat(amount);
  if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
    throw new Error('INVALID_AMOUNT');
  }

  // Check 3 decimal precision
  const amountStr = amount.toString();
  if (amountStr.includes('.') && amountStr.split('.')[1].length > 3) {
    throw new Error('INVALID_PRECISION');
  }

  const client = await pool.connect();
  let localRefundId = null;

  try {
    await client.query('BEGIN');
    if(!idempotencyKey||!/^[a-zA-Z0-9-]{20,100}$/.test(idempotencyKey))throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[idempotencyKey]);
    const prior=(await client.query('SELECT * FROM refunds WHERE idempotency_key=$1',[idempotencyKey])).rows[0];
    if(prior){if(prior.order_id!==orderId||prior.payment_id!==Number(paymentId)||Number(prior.amount)!==refundAmount)throw new Error('IDEMPOTENCY_CONFLICT');await client.query('COMMIT');return prior;}

    // 1. Lock payment row
    const { rows: paymentRows } = await client.query(
      'SELECT id, order_id, amount, status, provider_payment_id FROM payments WHERE id = $1 AND order_id = $2 FOR UPDATE',
      [paymentId, orderId]
    );

    if (paymentRows.length === 0) {
      throw new Error('PAYMENT_NOT_FOUND_OR_OWNERSHIP_MISMATCH');
    }

    const payment = paymentRows[0];

    // 2. Eligibility
    if (payment.status !== 'SUCCESS') {
      throw new Error('PAYMENT_NOT_ELIGIBLE');
    }
    if (!payment.provider_payment_id) {
      throw new Error('MISSING_PROVIDER_PAYMENT_ID');
    }

    // 3. Check existing refunds
    const { rows: refundRows } = await client.query(
      "SELECT COALESCE(SUM(amount), 0) AS total_refunded FROM refunds WHERE payment_id = $1 AND status IN ('PENDING', 'REFUNDED', 'PROCESSING', 'UNKNOWN', 'PROVIDER_ERROR')",
      [payment.id]
    );

    const totalRefunded = parseFloat(refundRows[0].total_refunded);
    const paymentAmount = parseFloat(payment.amount);
    const remaining = paymentAmount - totalRefunded;

    if (refundAmount > remaining) {
      throw new Error('AMOUNT_EXCEEDS_REMAINING_BALANCE');
    }

    // Check Idempotency globally or locally? Locally:
    if (idempotencyKey) {
      const { rows: existing } = await client.query(
        'SELECT * FROM refunds WHERE idempotency_key = $1 FOR UPDATE',
        [idempotencyKey]
      );
      if (existing.length > 0) {
        // Safe reuse, record and commit (finally will release client)
        await client.query('COMMIT');
        return existing[0];
      }
    }

    // 4. Create local attempt (status: PENDING)
    const insertRes = await client.query(`
      INSERT INTO refunds (
        order_id, payment_id, amount, currency, status, reason, requested_by_admin_id, idempotency_key
      ) VALUES ($1, $2, $3, 'KWD', 'PENDING', $4, $5, $6)
      RETURNING id, status, amount
    `, [payment.order_id, payment.id, refundAmount, reason, adminId, idempotencyKey || null]);

    localRefundId = insertRes.rows[0].id;

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // 5. External Provider Call (Outside of DB transaction, client already released)
  let providerRes = null;
  let finalStatus = 'FAILED';
  
  try {
    // 5a. Call Provider
    const { rows: paymentRows } = await pool.query('SELECT provider_payment_id FROM payments WHERE id = $1', [paymentId]);
    const providerPaymentId = paymentRows[0].provider_payment_id;

    providerRes = await myfatoorah.makeRefund({
      paymentId: providerPaymentId,
      amount: refundAmount,
      currency: 'KWD',
      comment: reason
    });
    
    // Determine provider status mapping
    // MyFatoorah returns RefundStatus which can be PENDING or REFUNDED or sometimes success implies pending
    if (providerRes.RefundStatus) {
      finalStatus = providerRes.RefundStatus.toUpperCase();
    } else {
      finalStatus = 'PROCESSING'; // fallback if they don't explicitly pass status but it succeeded
    }

  } catch (err) {
    console.error('Provider Refund Error:', err.message);
    // Provider rejected or network failure.
    finalStatus = err.definitive ? 'FAILED' : 'UNKNOWN';
    // If we're strictly not sure, we could use UNKNOWN. We'll use FAILED or PROVIDER_ERROR
  }

  // 6. Update local record with provider outcome
  try {
    if (providerRes && providerRes.RefundId) {
      await pool.query(`
        UPDATE refunds 
        SET status = $1, provider_refund_id = $2, provider_reference = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [finalStatus, providerRes.RefundId.toString(), providerRes.RefundReference, localRefundId]);
    } else {
      await pool.query(`
        UPDATE refunds 
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [finalStatus, localRefundId]);
    }
  } catch (updateErr) {
    console.error('Failed to update local refund record after provider call', updateErr);
    // Note: The refund exists as PENDING locally but provider call succeeded/failed. Reconciliation will fix it.
  }

  const { rows: finalRow } = await pool.query('SELECT * FROM refunds WHERE id = $1', [localRefundId]);

  return finalRow[0];
}

module.exports = {
  requestRefund
};
