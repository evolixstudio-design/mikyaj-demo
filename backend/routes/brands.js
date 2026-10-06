const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT b.id, b.name, b.slug, b.status, b.search_aliases, b.name_ar, b.name_en, b.image_url, b.image_alt_en, b.image_alt_ar, b.priority, COUNT(p.id)::int AS product_count
      FROM brands b
      JOIN products p ON p.brand_id=b.id AND p.status='ACTIVE' AND p.deleted_at IS NULL
      JOIN categories c ON c.id=p.category_id AND c.status='ACTIVE'
      WHERE b.status='ACTIVE'
      GROUP BY b.id
      ORDER BY b.priority DESC,b.name ASC, b.id ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('[Brands] Error fetching brands:', error.message);
    res.status(500).json({ error: true, message: 'Internal Server Error' });
  }
});

module.exports = router;
