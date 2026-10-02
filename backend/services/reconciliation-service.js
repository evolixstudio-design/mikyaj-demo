const { pool } = require('../db');

/**
 * Reconciles the local payment and refund state
 * Returns an object with the reconciliation summary and any warnings
 */
async function reconcilePayment(paymentId) {
  const { rows: paymentRows } = await pool.query(
    'SELECT id, amount, status FROM payments WHERE id = $1',
    [paymentId]
  );

  if (paymentRows.length === 0) {
    throw new Error('Payment not found');
  }

  const payment = paymentRows[0];
  const paidAmount = parseFloat(payment.amount);

  const { rows: refundRows } = await pool.query(
    'SELECT id, amount, status, provider_refund_id, provider_reference FROM refunds WHERE payment_id = $1',
    [paymentId]
  );

  let refundedCompletedAmount = 0;
  let refundedPendingAmount = 0;
  let warnings = [];

  for (const r of refundRows) {
    const amount = parseFloat(r.amount);
    if (r.status === 'REFUNDED') {
      refundedCompletedAmount += amount;
    } else if (r.status === 'PENDING' || r.status === 'PROCESSING') {
      refundedPendingAmount += amount;
    }

    if (!r.provider_refund_id) {
      warnings.push(`Local refund ID ${r.id} is missing a provider refund ID`);
    }
  }

  const remainingRefundableAmount = paidAmount - (refundedCompletedAmount + refundedPendingAmount);
  
  if (remainingRefundableAmount < 0) {
    warnings.push('OVER-REFUND RISK: Total requested or completed refunds exceed the original payment amount');
  }

  let reconciliationState = 'RECONCILED';
  if (warnings.length > 0) {
    reconciliationState = 'WARNING';
  }

  return {
    paymentId: payment.id,
    paymentStatus: payment.status,
    paidAmount,
    refundedCompletedAmount,
    refundedPendingAmount,
    remainingRefundableAmount,
    reconciliationState,
    warnings,
    refunds: refundRows
  };
}

module.exports = {
  reconcilePayment
};
