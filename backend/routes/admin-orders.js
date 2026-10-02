const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { changeOrderStatus, cancelOrder } = require('../services/order-service');

// GET /api/admin/orders
router.get('/', async (req, res) => {
  try {
    const { status, payment_status, search, date_from, date_to, min_total, max_total, limit = 20, cursor } = req.query;

    let parsedLimit = parseInt(limit, 10);
    if (isNaN(parsedLimit) || parsedLimit <= 0) parsedLimit = 20;
    if (parsedLimit > 100) parsedLimit = 100;

    let query = `
      SELECT o.id, o.order_number, o.customer_name, o.customer_phone, o.customer_email, 
             o.total_amount, o.currency, o.status, o.created_at, o.updated_at,
             (
                SELECT p.status 
                FROM payments p 
                WHERE p.order_id = o.id 
                ORDER BY p.created_at DESC 
                LIMIT 1
             ) as payment_status
      FROM orders o
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND o.status = $${paramIndex++}`;
      params.push(status);
    }

    if (payment_status) {
      // payment status is determined by the most recent payment attempt
      query += ` AND (
        SELECT p.status 
        FROM payments p 
        WHERE p.order_id = o.id 
        ORDER BY p.created_at DESC 
        LIMIT 1
      ) = $${paramIndex++}`;
      params.push(payment_status);
    }

    if (search) {
      query += ` AND (
        o.order_number ILIKE $${paramIndex} OR 
        o.customer_name ILIKE $${paramIndex} OR 
        o.customer_phone ILIKE $${paramIndex} OR 
        o.customer_email ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (date_from) {
      query += ` AND o.created_at >= $${paramIndex++}`;
      params.push(new Date(date_from).toISOString());
    }

    if (date_to) {
      query += ` AND o.created_at <= $${paramIndex++}`;
      params.push(new Date(date_to).toISOString());
    }

    if (min_total) {
      query += ` AND o.total_amount >= $${paramIndex++}`;
      params.push(min_total);
    }

    if (max_total) {
      if (min_total && parseFloat(min_total) > parseFloat(max_total)) {
         return res.status(400).json({ error: 'min_total cannot be greater than max_total' });
      }
      query += ` AND o.total_amount <= $${paramIndex++}`;
      params.push(max_total);
    }

    // Cursor pagination (assuming descending order by id)
    if (cursor) {
      const cursorId = parseInt(cursor, 10);
      if (isNaN(cursorId)) {
        return res.status(400).json({ error: 'Invalid cursor format' });
      }
      query += ` AND o.id < $${paramIndex++}`;
      params.push(cursorId);
    }

    query += ` ORDER BY o.id DESC LIMIT $${paramIndex++}`;
    params.push(parsedLimit + 1); // fetch one extra to determine next cursor

    const { rows } = await pool.query(query, params);

    let nextCursor = null;
    if (rows.length > parsedLimit) {
      nextCursor = rows[parsedLimit].id.toString();
      rows.pop(); // remove the extra item
    }

    res.json({
      orders: rows.map(r => {
        const { id, ...orderData } = r;
        return orderData;
      }),
      next_cursor: nextCursor
    });

  } catch (err) {
    console.error('List orders error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/orders/:orderNumber
router.get('/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;

    const { rows: orderRows } = await pool.query(`
      SELECT o.id, o.order_number, o.customer_name, o.customer_phone, o.customer_address, o.customer_email,
             o.total_amount, o.currency, o.status, o.created_at, o.updated_at
      FROM orders o
      WHERE o.order_number = $1
    `, [orderNumber]);

    if (orderRows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderRows[0];

    const { rows: itemRows } = await pool.query(`
      SELECT oi.product_id, p.sku, p.name_en AS product_name, oi.quantity, oi.price_at_purchase,
             (oi.quantity * oi.price_at_purchase) AS line_total,
             (SELECT cloudinary_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY image_order ASC LIMIT 1) as image_url
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = $1
    `, [order.id]);

    const { rows: paymentRows } = await pool.query(`
      SELECT provider, provider_invoice_id, provider_payment_id, provider_reference, status, amount, currency, created_at
      FROM payments
      WHERE order_id = $1
      ORDER BY created_at DESC
    `, [order.id]);

    // Computed payment status
    let paymentStatus = 'UNKNOWN';
    if (paymentRows.length > 0) {
       paymentStatus = paymentRows[0].status; // authoritative based on most recent
    }

    // Consistency check
    let consistency = null;
    if (order.status !== 'PENDING_PAYMENT' && order.status !== 'CANCELLED' && paymentStatus !== 'SUCCESS' && paymentStatus !== 'PAID') {
      consistency = {
        status: 'WARNING',
        code: 'ORDER_PAYMENT_STATE_REQUIRES_REVIEW',
        message: 'Order status indicates progression but payment is not PAID/SUCCESS.'
      };
    } else if (order.status === 'PENDING_PAYMENT' && paymentStatus === 'SUCCESS') {
      consistency = {
        status: 'WARNING',
        code: 'PAYMENT_COMPLETE_ORDER_PENDING',
        message: 'Payment is SUCCESS but order is still PENDING_PAYMENT.'
      };
    }

    // Active driver assignment
    const { rows: assignRows } = await pool.query(`
      SELECT oda.id, oda.driver_id, oda.status, oda.assigned_at, d.name AS driver_name, d.phone AS driver_phone
      FROM order_driver_assignments oda
      JOIN drivers d ON oda.driver_id = d.id
      WHERE oda.order_id = $1 AND oda.status = 'ACTIVE'
      LIMIT 1
    `, [order.id]);

    res.json({
      order: {
        order_number: order.order_number,
        status: order.status,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_email: order.customer_email,
        customer_address: order.customer_address,
        total_amount: order.total_amount,
        currency: order.currency,
        created_at: order.created_at,
        updated_at: order.updated_at
      },
      items: itemRows,
      payment: {
        computed_status: paymentStatus,
        history: paymentRows
      },
      driver_assignment: assignRows.length > 0 ? assignRows[0] : null,
      consistency
    });

  } catch (err) {
    console.error('Get order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/orders/:orderNumber/status
router.patch('/:orderNumber/status', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { status, reason } = req.body;
    const adminId = req.admin.id;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const result = await changeOrderStatus(orderNumber, status, reason, adminId);
    res.json(result);

  } catch (err) {
    console.error('Update status error:', err);
    if (err.message === 'ORDER_NOT_FOUND') return res.status(404).json({ error: 'Order not found' });
    if (err.message === 'INVALID_TRANSITION') return res.status(409).json({ error: 'Invalid state transition' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/orders/:orderNumber/cancel
router.post('/:orderNumber/cancel', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { reason } = req.body;
    const adminId = req.admin.id;

    const result = await cancelOrder(orderNumber, reason, adminId);
    res.json(result);

  } catch (err) {
    console.error('Cancel order error:', err);
    if (err.message === 'REASON_REQUIRED') return res.status(400).json({ error: 'Cancellation reason is required' });
    if (err.message === 'ORDER_NOT_FOUND') return res.status(404).json({ error: 'Order not found' });
    if (err.message === 'INVALID_TRANSITION') return res.status(409).json({ error: 'Order cannot be cancelled from its current state' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

const deliveryService = require('../services/delivery-service');

// POST /api/admin/orders/:orderNumber/assign-driver
router.post('/:orderNumber/assign-driver', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { driver_id, notes } = req.body;
    const adminId = req.admin.id;

    if (!driver_id) {
      return res.status(400).json({ error: 'Driver ID is required' });
    }

    const result = await deliveryService.assignDriver(orderNumber, driver_id, adminId, notes);
    res.json(result);
  } catch (err) {
    console.error('Assign driver error:', err);
    if (err.message === 'ORDER_NOT_FOUND') return res.status(404).json({ error: 'Order not found' });
    if (err.message === 'ORDER_NOT_ELIGIBLE_FOR_ASSIGNMENT') return res.status(409).json({ error: 'Order must be READY_FOR_DELIVERY to assign a driver' });
    if (err.message === 'DRIVER_NOT_FOUND') return res.status(404).json({ error: 'Driver not found' });
    if (err.message === 'DRIVER_INACTIVE') return res.status(409).json({ error: 'Driver is inactive' });
    if (err.message === 'DRIVER_ALREADY_ASSIGNED') return res.status(409).json({ error: 'Driver is already assigned to this order' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/orders/:orderNumber/unassign-driver
router.post('/:orderNumber/unassign-driver', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const adminId = req.admin.id;

    const result = await deliveryService.unassignDriver(orderNumber, adminId);
    res.json(result);
  } catch (err) {
    console.error('Unassign driver error:', err);
    if (err.message === 'ORDER_NOT_FOUND') return res.status(404).json({ error: 'Order not found' });
    if (err.message === 'ORDER_ALREADY_DELIVERED') return res.status(409).json({ error: 'Delivered orders cannot be unassigned' });
    if (err.message === 'NO_ACTIVE_ASSIGNMENT') return res.status(404).json({ error: 'No active driver assignment found for this order' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/orders/:orderNumber/history
router.get('/:orderNumber/history', async (req, res) => {
  try {
    const { orderNumber } = req.params;

    const { rows } = await pool.query(`
      SELECT osh.old_status, osh.new_status, osh.reason, osh.created_at,
             au.id AS admin_id, au.email AS admin_email
      FROM order_status_history osh
      JOIN orders o ON osh.order_id = o.id
      LEFT JOIN admin_users au ON osh.changed_by_admin_id = au.id
      WHERE o.order_number = $1
      ORDER BY osh.created_at ASC
    `, [orderNumber]);

    res.json({
      history: rows.map(r => ({
        old_status: r.old_status,
        new_status: r.new_status,
        reason: r.reason,
        created_at: r.created_at,
        changed_by: r.admin_id ? { id: r.admin_id, email: r.admin_email } : null
      }))
    });

  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/orders/:orderNumber/payments
router.get('/:orderNumber/payments', async (req, res) => {
  try {
    const { orderNumber } = req.params;

    const { rows } = await pool.query(`
      SELECT p.provider, p.provider_invoice_id, p.provider_payment_id, p.provider_reference, 
             p.status, p.amount, p.currency, p.created_at
      FROM payments p
      JOIN orders o ON p.order_id = o.id
      WHERE o.order_number = $1
      ORDER BY p.created_at DESC
    `, [orderNumber]);

    res.json({ payments: rows });

  } catch (err) {
    console.error('Get payments error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
