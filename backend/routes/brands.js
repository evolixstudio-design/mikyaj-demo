const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, slug, status 
      FROM brands 
      WHERE status = 'ACTIVE' 
      ORDER BY name ASC, id ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('[Brands] Error fetching brands:', error.message);
    res.status(500).json({ error: true, message: 'Internal Server Error' });
  }
});

module.exports = router;
