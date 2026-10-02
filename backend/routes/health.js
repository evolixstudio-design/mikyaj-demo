const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    // Verify DB connectivity
    await db.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('[Health Check] Database unavailable:', error.message);
    res.status(503).json({ status: 'error', message: 'Database unavailable' });
  }
});

module.exports = router;
