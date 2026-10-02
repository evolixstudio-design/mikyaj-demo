const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requestRefund } = require('../services/refund-service');
const { requireAdminAuth } = require('../middleware/admin-auth');

// POST /api/admin/orders/:orderNumber/refunds
router.post('/orders/:orderNumber/refunds', requireAdminAuth, async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { payment_id, amount, reason, idempotency_key } = req.body;
    const adminId = req.admin.id;

    if (!payment_id || !amount || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (reason.trim().length === 0) {
      return res.status(400).json({ error: 'Reason cannot be whitespace only' });
    }

    // Lookup order ID
    const { rows: orderRows } = await pool.query('SELECT id FROM orders WHERE order_number = $1', [orderNumber]);
    if (orderRows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const orderId = orderRows[0].id;

    const result = await requestRefund({
      orderId,
      paymentId: payment_id,
      amount,
      reason,
      adminId,
      idempotencyKey: idempotency_key
    });

    res.json({ success: true, refund: result });
  } catch (err) {
    console.error('Refund Request Error:', err.message);
    let status = 400;
    if (err.message.includes('NOT_FOUND') || err.message.includes('MISMATCH')) status = 404;
    res.status(status).json({ error: err.message });
  }
});

// GET /api/admin/refunds
router.get('/refunds', requireAdminAuth, async (req, res) => {
  try {
    const { order_number, status } = req.query;
    
    let query = `
      SELECT r.*, o.order_number 
      FROM refunds r
      JOIN orders o ON r.order_id = o.id
      WHERE 1=1
    `;
    const params = [];
    
    if (order_number) {
      params.push(order_number);
      query += ` AND o.order_number = $${params.length}`;
    }
    
    if (status) {
      params.push(status);
      query += ` AND r.status = $${params.length}`;
    }
    
    query += ` ORDER BY r.created_at DESC LIMIT 50`;
    
    const { rows } = await pool.query(query, params);
    res.json({ success: true, refunds: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/admin/refunds/:id
router.get('/refunds/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(`
      SELECT r.*, o.order_number, p.provider_payment_id
      FROM refunds r
      JOIN orders o ON r.order_id = o.id
      JOIN payments p ON r.payment_id = p.id
      WHERE r.id = $1
    `, [id]);
    
    if (rows.length === 0) return res.status(404).json({ error: 'Refund not found' });
    
    res.json({ success: true, refund: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/admin/orders/:orderNumber/refunds
router.get('/orders/:orderNumber/refunds', requireAdminAuth, async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { rows: orderRows } = await pool.query('SELECT id FROM orders WHERE order_number = $1', [orderNumber]);
    if (orderRows.length === 0) return res.status(404).json({ error: 'Order not found' });
    
    const { rows } = await pool.query('SELECT * FROM refunds WHERE order_id = $1 ORDER BY created_at DESC', [orderRows[0].id]);
    res.json({ success: true, refunds: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const { reconcilePayment } = require('../services/reconciliation-service');

// GET /api/admin/orders/:orderNumber/reconciliation
router.get('/orders/:orderNumber/reconciliation', requireAdminAuth, async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { rows: orderRows } = await pool.query('SELECT id FROM orders WHERE order_number = $1', [orderNumber]);
    if (orderRows.length === 0) return res.status(404).json({ error: 'Order not found' });
    
    const { rows: paymentRows } = await pool.query("SELECT id FROM payments WHERE order_id = $1 AND status = 'SUCCESS'", [orderRows[0].id]);
    if (paymentRows.length === 0) return res.status(404).json({ error: 'No successful payment found for reconciliation' });
    
    const reconciliation = await reconcilePayment(paymentRows[0].id);
    res.json({ success: true, reconciliation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
