const express = require('express');
const router = express.Router();
const { requireAdminAuth } = require('../middleware/admin-auth');
const driverService = require('../services/driver-service');

router.use(requireAdminAuth);

// GET /api/admin/drivers
router.get('/', async (req, res) => {
  try {
    const drivers = await driverService.listDrivers();
    res.json({ drivers });
  } catch (err) {
    console.error('List drivers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/drivers
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, password, status } = req.body;
    const adminId = req.admin.id;

    const driver = await driverService.createDriver(adminId, { name, phone, email, password, status });
    res.status(201).json({ driver, message: 'Driver created successfully' });
  } catch (err) {
    console.error('Create driver error:', err);
    if (err.message === 'MISSING_FIELDS') return res.status(400).json({ error: 'Name, phone, email, and password are required' });
    if (err.message === 'DUPLICATE_EMAIL') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/drivers/:driverId/status
router.patch('/:driverId/status', async (req, res) => {
  try {
    const { driverId } = req.params;
    const { status } = req.body;

    const updated = await driverService.changeDriverStatus(driverId, status);
    res.json({ driver: updated, message: 'Status updated successfully' });
  } catch (err) {
    console.error('Change driver status error:', err);
    if (err.message === 'INVALID_STATUS') return res.status(400).json({ error: 'Invalid status' });
    if (err.message === 'DRIVER_NOT_FOUND') return res.status(404).json({ error: 'Driver not found' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
