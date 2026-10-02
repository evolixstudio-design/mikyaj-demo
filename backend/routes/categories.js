const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name_ar, name_en, slug, status 
      FROM categories 
      WHERE status = 'ACTIVE' 
      ORDER BY name_en ASC, id ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('[Categories] Error fetching categories:', error.message);
    res.status(500).json({ error: true, message: 'Internal Server Error' });
  }
});

module.exports = router;
