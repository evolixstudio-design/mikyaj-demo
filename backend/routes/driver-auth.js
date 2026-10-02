const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const driverService = require('../services/driver-service');

// POST /api/driver/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const driver = await driverService.loginDriver(email, password);

    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret) {
      console.error('CRITICAL: ADMIN_JWT_SECRET is not configured.');
      return res.status(500).json({ error: 'Internal server error' });
    }

    // Driver JWT expires in 24 hours
    const token = jwt.sign(driver, secret, { expiresIn: '24h' });

    res.json({ token, driver });
  } catch (err) {
    console.error('Driver login error:', err);
    if (err.message === 'INVALID_CREDENTIALS') return res.status(401).json({ error: 'Invalid email or password' });
    if (err.message === 'DRIVER_INACTIVE') return res.status(401).json({ error: 'Account is inactive' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
