const { pool } = require('../db');

// Re-use logic from order-service where possible for status transitions
const { isValidTransition } = require('./order-service');

async function assignDriver(orderNumber, driverId, adminId, notes) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock the order
    const { rows: orderRows } = await client.query(
      'SELECT id, status FROM orders WHERE order_number = $1 FOR UPDATE',
      [orderNumber]
    );

    if (orderRows.length === 0) {
      throw new Error('ORDER_NOT_FOUND');
    }
    const order = orderRows[0];

    // 2. Only READY_FOR_DELIVERY is assignable by default
    if (order.status !== 'READY_FOR_DELIVERY') {
      throw new Error('ORDER_NOT_ELIGIBLE_FOR_ASSIGNMENT');
    }

    // 3. Verify driver exists and is ACTIVE
    const { rows: driverRows } = await client.query('SELECT id, status FROM drivers WHERE id = $1', [driverId]);
    if (driverRows.length === 0) {
      throw new Error('DRIVER_NOT_FOUND');
    }
    if (driverRows[0].status !== 'ACTIVE') {
      throw new Error('DRIVER_INACTIVE');
    }

    // 4. Lock and complete any existing active assignments for this order
    const { rows: activeAssignments } = await client.query(`
      SELECT id, driver_id FROM order_driver_assignments
      WHERE order_id = $1 AND status = 'ACTIVE' FOR UPDATE
    `, [order.id]);

    if (activeAssignments.length > 0) {
      // Reassignment
      if (activeAssignments[0].driver_id === parseInt(driverId, 10)) {
        throw new Error('DRIVER_ALREADY_ASSIGNED');
      }

      await client.query(`
        UPDATE order_driver_assignments
        SET status = 'UNASSIGNED', unassigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [activeAssignments[0].id]);
    }

    // 5. Create new assignment
    await client.query(`
      INSERT INTO order_driver_assignments (order_id, driver_id, assigned_by_admin_id, status, notes)
      VALUES ($1, $2, $3, 'ACTIVE', $4)
    `, [order.id, driverId, adminId, notes || null]);

    await client.query('COMMIT');
    return { success: true, message: 'Driver assigned successfully' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function unassignDriver(orderNumber, adminId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: orderRows } = await client.query(
      'SELECT id, status FROM orders WHERE order_number = $1 FOR UPDATE',
      [orderNumber]
    );

    if (orderRows.length === 0) {
      throw new Error('ORDER_NOT_FOUND');
    }
    const order = orderRows[0];

    // Cannot unassign a delivered/cancelled order generally, 
    // but definitely can if it's still READY_FOR_DELIVERY or OUT_FOR_DELIVERY.
    if (order.status === 'DELIVERED') {
       throw new Error('ORDER_ALREADY_DELIVERED');
    }

    const { rows: activeAssignments } = await client.query(`
      SELECT id FROM order_driver_assignments
      WHERE order_id = $1 AND status = 'ACTIVE' FOR UPDATE
    `, [order.id]);

    if (activeAssignments.length === 0) {
      throw new Error('NO_ACTIVE_ASSIGNMENT');
    }

    await client.query(`
      UPDATE order_driver_assignments
      SET status = 'UNASSIGNED', unassigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [activeAssignments[0].id]);

    await client.query('COMMIT');
    return { success: true, message: 'Driver unassigned successfully' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getDriverOrders(driverId, limit = 20, cursor = null) {
  let query = `
    SELECT o.order_number, o.customer_name, o.customer_phone, o.customer_address,
           o.total_amount, o.currency, o.status, o.created_at,
           oda.assigned_at, oda.notes as assignment_notes, oda.id as assignment_id
    FROM orders o
    JOIN order_driver_assignments oda ON o.id = oda.order_id
    WHERE oda.driver_id = $1 AND oda.status = 'ACTIVE'
  `;
  const params = [driverId];
  let paramIndex = 2;

  if (cursor) {
    query += ` AND oda.id < $${paramIndex++}`;
    params.push(parseInt(cursor, 10));
  }

  query += ` ORDER BY oda.id DESC LIMIT $${paramIndex}`;
  params.push(limit + 1);

  const { rows } = await pool.query(query, params);

  let nextCursor = null;
  if (rows.length > limit) {
    nextCursor = rows[limit].assignment_id.toString();
    rows.pop();
  }

  return { orders: rows, next_cursor: nextCursor };
}

async function getDriverOrderDetail(orderNumber, driverId) {
  const { rows: orderRows } = await pool.query(`
    SELECT o.id, o.order_number, o.customer_name, o.customer_phone, o.customer_address,
           o.total_amount, o.currency, o.status,
           oda.assigned_at, oda.notes as assignment_notes
    FROM orders o
    JOIN order_driver_assignments oda ON o.id = oda.order_id
    WHERE o.order_number = $1 AND oda.driver_id = $2 AND oda.status IN ('ACTIVE', 'COMPLETED')
    ORDER BY oda.id DESC LIMIT 1
  `, [orderNumber, driverId]);

  if (orderRows.length === 0) {
    throw new Error('ORDER_NOT_FOUND_OR_NOT_ASSIGNED');
  }

  const order = orderRows[0];

  const { rows: itemRows } = await pool.query(`
    SELECT p.name_en AS product_name, oi.quantity
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = $1
  `, [order.id]);

  return {
    order_number: order.order_number,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    customer_address: order.customer_address,
    total_amount: order.total_amount,
    currency: order.currency,
    status: order.status,
    assigned_at: order.assigned_at,
    assignment_notes: order.assignment_notes,
    items: itemRows
  };
}

async function startDelivery(orderNumber, driverId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: orderRows } = await client.query(
      'SELECT id, status FROM orders WHERE order_number = $1 FOR UPDATE',
      [orderNumber]
    );

    if (orderRows.length === 0) throw new Error('ORDER_NOT_FOUND');
    const order = orderRows[0];

    const { rows: assignmentRows } = await client.query(`
      SELECT id, driver_id FROM order_driver_assignments
      WHERE order_id = $1 AND status = 'ACTIVE' FOR UPDATE
    `, [order.id]);

    if (assignmentRows.length === 0 || assignmentRows[0].driver_id !== parseInt(driverId, 10)) {
      throw new Error('ORDER_NOT_ASSIGNED_TO_DRIVER');
    }

    if (order.status !== 'READY_FOR_DELIVERY') {
      throw new Error('INVALID_TRANSITION');
    }

    if (!isValidTransition('READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY')) {
      throw new Error('INVALID_TRANSITION_STATE');
    }

    await client.query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['OUT_FOR_DELIVERY', order.id]
    );

    await client.query(`
      INSERT INTO order_status_history (order_id, old_status, new_status, changed_by_driver_id)
      VALUES ($1, $2, $3, $4)
    `, [order.id, 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', driverId]);

    await client.query('COMMIT');
    return { success: true, status: 'OUT_FOR_DELIVERY' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function markDelivered(orderNumber, driverId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: orderRows } = await client.query(
      'SELECT id, status FROM orders WHERE order_number = $1 FOR UPDATE',
      [orderNumber]
    );

    if (orderRows.length === 0) throw new Error('ORDER_NOT_FOUND');
    const order = orderRows[0];

    const { rows: assignmentRows } = await client.query(`
      SELECT id, driver_id FROM order_driver_assignments
      WHERE order_id = $1 AND status = 'ACTIVE' FOR UPDATE
    `, [order.id]);

    if (assignmentRows.length === 0 || assignmentRows[0].driver_id !== parseInt(driverId, 10)) {
      throw new Error('ORDER_NOT_ASSIGNED_TO_DRIVER');
    }

    if (order.status !== 'OUT_FOR_DELIVERY') {
      throw new Error('INVALID_TRANSITION');
    }

    await client.query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['DELIVERED', order.id]
    );

    await client.query(`
      INSERT INTO order_status_history (order_id, old_status, new_status, changed_by_driver_id)
      VALUES ($1, $2, $3, $4)
    `, [order.id, 'OUT_FOR_DELIVERY', 'DELIVERED', driverId]);

    // Close assignment
    await client.query(`
      UPDATE order_driver_assignments
      SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [assignmentRows[0].id]);

    await client.query('COMMIT');
    return { success: true, status: 'DELIVERED' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  assignDriver,
  unassignDriver,
  getDriverOrders,
  getDriverOrderDetail,
  startDelivery,
  markDelivered
};
