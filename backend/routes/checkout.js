const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const myfatoorah = require('../services/myfatoorah');

// POST /api/checkout
// Receives: { idempotencyKey, customer: { name, phone, address, email }, items: [{ productId, qty }] }
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { idempotencyKey, customer, items } = req.body;

    // 1. Basic validation
    if (!idempotencyKey) {
      return res.status(400).json({ error: 'Missing idempotency key.' });
    }
    if (!customer || !customer.name || !customer.phone || !customer.address) {
      return res.status(400).json({ error: 'Missing required customer details.' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty.' });
    }

    // 2. Check for idempotency (has this checkout attempt already resulted in an order?)
    const { rows: existingOrders } = await client.query(
      'SELECT id, order_number, total_amount, status FROM orders WHERE idempotency_key = $1',
      [idempotencyKey]
    );

    let order;

    if (existingOrders.length > 0) {
      order = existingOrders[0];
    } else {
      // Create new order via transaction
      await client.query('BEGIN');
      
      let totalAmountFils = 0;
      const orderItems = [];
      const productQuantities = {};

      // Validate products, aggregate duplicate quantities
      for (const item of items) {
        const { productId, qty } = item;
        const safeQty = parseInt(qty, 10);
        if (isNaN(safeQty) || safeQty < 1) {
          throw new Error(`Invalid quantity for product ID: ${productId}.`);
        }
        productQuantities[productId] = (productQuantities[productId] || 0) + safeQty;
      }

      for (const [productId, qty] of Object.entries(productQuantities)) {
        let query;
        let params;
        
        if (!isNaN(productId)) {
            query = 'SELECT id, selling_price, status FROM products WHERE id = $1';
            params = [productId];
        } else {
            query = 'SELECT id, selling_price, status FROM products WHERE slug = $1 OR sku = $1';
            params = [productId];
        }
        
        const { rows } = await client.query(query, params);

        if (rows.length === 0) {
          throw new Error(`Product not found (ID: ${productId}).`);
        }

        const product = rows[0];
        if (product.status !== 'ACTIVE') {
          throw new Error(`Product is no longer available (ID: ${productId}).`);
        }

        // Use integer fils math for precise KWD calculation
        const priceFils = Math.round(parseFloat(product.selling_price) * 1000);
        totalAmountFils += priceFils * qty;

        orderItems.push({
          product_id: product.id,
          quantity: qty,
          price_at_purchase: (priceFils / 1000).toFixed(3)
        });
      }
      
      const totalAmount = (totalAmountFils / 1000).toFixed(3);

      const orderNumber = 'MKJ-' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 1000).toString().padStart(3, '0');

      const orderQuery = `
        INSERT INTO orders (
          order_number, customer_name, customer_phone, customer_address, customer_email, total_amount, status, idempotency_key
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, order_number, total_amount, status, created_at
      `;
      const orderParams = [
        orderNumber,
        customer.name,
        customer.phone,
        customer.address,
        customer.email || null,
        totalAmount,
        'PENDING_PAYMENT',
        idempotencyKey
      ];
      
      const { rows: orderRows } = await client.query(orderQuery, orderParams);
      order = orderRows[0];

      const itemQuery = `
        INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
        VALUES ($1, $2, $3, $4)
      `;
      for (const oi of orderItems) {
        await client.query(itemQuery, [order.id, oi.product_id, oi.quantity, oi.price_at_purchase]);
      }

      await client.query('COMMIT');
    }

    // 3. Initiate MyFatoorah Payment
    // We only initiate payment if the order is still pending.
    if (order.status !== 'PENDING_PAYMENT') {
       return res.status(400).json({ error: `Cannot initiate payment for order in ${order.status} state.` });
    }

    // CREATE PENDING PAYMENT ROW FIRST to prevent orphaned external invoices
    const { rows: paymentRows } = await client.query(`
      INSERT INTO payments (order_id, provider, status, amount, currency)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [order.id, 'MYFATOORAH', 'PENDING', order.total_amount, 'KWD']);
    const paymentId = paymentRows[0].id;

    try {
      const paymentData = await myfatoorah.initiatePayment({
        invoiceAmount: order.total_amount,
        orderId: order.order_number,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerEmail: customer.email
      });

      const invoiceId = paymentData.InvoiceId.toString();
      const invoiceURL = paymentData.InvoiceURL;

      // UPDATE PAYMENT RECORD WITH INVOICE ID
      await client.query(`
        UPDATE payments SET provider_invoice_id = $1 WHERE id = $2
      `, [invoiceId, paymentId]);

      res.status(201).json({
        success: true,
        order: {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          total_amount: order.total_amount
        },
        payment: {
          status: 'PENDING',
          redirect_url: invoiceURL
        }
      });
    } catch (paymentErr) {
      console.error('Payment initiation failed:', paymentErr.message);
      // UPDATE FAILED PAYMENT ATTEMPT
      await client.query(`
        UPDATE payments SET status = $1 WHERE id = $2
      `, ['FAILED', paymentId]);

      res.status(500).json({
        success: false,
        error: 'Order created but payment initiation failed. Please try again.',
        order: order
      });
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Checkout error:', error.message);
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
