const express = require('express');
const router = express.Router();
const { requireDriverAuth } = require('../middleware/driver-auth');
const deliveryService = require('../services/delivery-service');

router.use(requireDriverAuth);

// GET /api/driver/orders
router.get('/', async (req, res) => {
  try {
    const { limit = 20, cursor } = req.query;
    let parsedLimit = parseInt(limit, 10);
    if (isNaN(parsedLimit) || parsedLimit <= 0) parsedLimit = 20;
    if (parsedLimit > 100) parsedLimit = 100;

    const driverId = req.driver.id;

    const result = await deliveryService.getDriverOrders(driverId, parsedLimit, cursor);
    res.json(result);
  } catch (err) {
    console.error('Get driver orders error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/driver/orders/:orderNumber
router.get('/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const driverId = req.driver.id;

    const result = await deliveryService.getDriverOrderDetail(orderNumber, driverId);
    res.json({ order: result });
  } catch (err) {
    console.error('Get driver order detail error:', err);
    if (err.message === 'ORDER_NOT_FOUND_OR_NOT_ASSIGNED') return res.status(403).json({ error: 'Order not found or not assigned to you' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/driver/orders/:orderNumber/start-delivery
router.post('/:orderNumber/start-delivery', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const driverId = req.driver.id;

    const result = await deliveryService.startDelivery(orderNumber, driverId);
    res.json(result);
  } catch (err) {
    console.error('Start delivery error:', err);
    if (err.message === 'ORDER_NOT_FOUND') return res.status(404).json({ error: 'Order not found' });
    if (err.message === 'ORDER_NOT_ASSIGNED_TO_DRIVER') return res.status(403).json({ error: 'Order not assigned to you' });
    if (err.message === 'INVALID_TRANSITION' || err.message === 'INVALID_TRANSITION_STATE') return res.status(409).json({ error: 'Order cannot start delivery from its current state' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/driver/orders/:orderNumber/mark-delivered
router.post('/:orderNumber/mark-delivered', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const driverId = req.driver.id;

    const result = await deliveryService.markDelivered(orderNumber, driverId);
    res.json(result);
  } catch (err) {
    console.error('Mark delivered error:', err);
    if (err.message === 'ORDER_NOT_FOUND') return res.status(404).json({ error: 'Order not found' });
    if (err.message === 'ORDER_NOT_ASSIGNED_TO_DRIVER') return res.status(403).json({ error: 'Order not assigned to you' });
    if (err.message === 'INVALID_TRANSITION') return res.status(409).json({ error: 'Order cannot be marked delivered from its current state' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
