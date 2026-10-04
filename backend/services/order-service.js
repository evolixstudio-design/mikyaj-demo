const { pool } = require('../db');

const VALID_TRANSITIONS = {
  PENDING_PAYMENT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'OUT_FOR_DELIVERY', 'CANCELLED'],
  PROCESSING: ['READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'CANCELLED'],
  READY_FOR_DELIVERY: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: []
};

function isValidTransition(oldStatus, newStatus) {
  const allowed = VALID_TRANSITIONS[oldStatus];
  return allowed ? allowed.includes(newStatus) : false;
}

async function changeOrderStatus(orderNumber, newStatus, reason, adminId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the row for update to prevent concurrent status changes
    const { rows } = await client.query(
      'SELECT id, status, payment_method FROM orders WHERE order_number = $1 FOR UPDATE',
      [orderNumber]
    );

    if (rows.length === 0) {
      throw new Error('ORDER_NOT_FOUND');
    }

    const order = rows[0];
    const currentStatus = order.status;

    if (currentStatus === newStatus) {
      // Idempotent success or no-op
      await client.query('ROLLBACK');
      return { success: true, status: currentStatus, message: 'Status is already ' + newStatus };
    }

    if (!isValidTransition(currentStatus, newStatus)) {
      throw new Error('INVALID_TRANSITION');
    }

    if (currentStatus === 'PENDING_PAYMENT' && newStatus === 'CONFIRMED') {
      const paid = await client.query("SELECT id FROM payments WHERE order_id=$1 AND status='SUCCESS' LIMIT 1", [order.id]);
      if (!paid.rows.length) throw new Error('INVALID_TRANSITION');
    }

    // Update order status
    await client.query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newStatus, order.id]
    );

    // Insert history record
    await client.query(`
      INSERT INTO order_status_history (order_id, old_status, new_status, reason, changed_by_admin_id)
      VALUES ($1, $2, $3, $4, $5)
    `, [order.id, currentStatus, newStatus, reason || null, adminId]);

    await client.query('COMMIT');
    
    return { success: true, status: newStatus };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function cancelOrder(orderNumber, reason, adminId) {
  if (!reason || !reason.trim()) {
    throw new Error('REASON_REQUIRED');
  }
  return await changeOrderStatus(orderNumber, 'CANCELLED', reason.trim(), adminId);
}

module.exports = {
  isValidTransition,
  changeOrderStatus,
  cancelOrder
};
