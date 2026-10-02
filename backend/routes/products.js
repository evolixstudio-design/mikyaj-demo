const express = require('express');
const router = express.Router();
const db = require('../db');

function encodeCursor(id) {
  return Buffer.from(id.toString()).toString('base64');
}

function decodeCursor(cursor) {
  const str = Buffer.from(cursor, 'base64').toString('ascii');
  const id = parseInt(str, 10);
  return isNaN(id) ? null : id;
}

// GET /api/products
router.get('/', async (req, res) => {
  try {
    const { limit, cursor, search, category, brand, min_price, max_price } = req.query;

    // 1. Limit parsing and capping
    let parsedLimit = parseInt(limit, 10) || 24;
    if (parsedLimit <= 0) return res.status(400).json({ error: true, message: 'Invalid limit' });
    if (parsedLimit > 60) parsedLimit = 60; // Hard max

    // 2. Cursor parsing
    let cursorId = null;
    if (cursor) {
      cursorId = decodeCursor(cursor);
      if (cursorId === null) {
        return res.status(400).json({ error: true, message: 'Invalid cursor' });
      }
    }

    // 3. Price validation
    let minPrice = null, maxPrice = null;
    if (min_price) {
      minPrice = parseFloat(min_price);
      if (isNaN(minPrice) || minPrice < 0) return res.status(400).json({ error: true, message: 'Invalid min_price' });
    }
    if (max_price) {
      maxPrice = parseFloat(max_price);
      if (isNaN(maxPrice) || maxPrice < 0) return res.status(400).json({ error: true, message: 'Invalid max_price' });
    }
    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
      return res.status(400).json({ error: true, message: 'min_price cannot be greater than max_price' });
    }

    // 4. Query construction
    const params = [];
    let paramIndex = 1;
    let whereClauses = ["p.status = 'ACTIVE'", "c.status = 'ACTIVE'"];

    if (cursorId !== null) {
      whereClauses.push(`p.id < $${paramIndex++}`);
      params.push(cursorId);
    }

    if (category) {
      whereClauses.push(`c.slug = $${paramIndex++}`);
      params.push(category);
    }

    if (brand) {
      whereClauses.push(`b.slug = $${paramIndex++}`);
      params.push(brand);
    }

    if (minPrice !== null) {
      whereClauses.push(`p.selling_price >= $${paramIndex++}`);
      params.push(minPrice);
    }

    if (maxPrice !== null) {
      whereClauses.push(`p.selling_price <= $${paramIndex++}`);
      params.push(maxPrice);
    }

    if (search) {
      whereClauses.push(`(p.name_ar ILIKE $${paramIndex} OR p.name_en ILIKE $${paramIndex} OR p.sku ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // We fetch limit + 1 to check if there is a next page
    params.push(parsedLimit + 1);
    const limitString = `LIMIT $${paramIndex}`;

    const queryStr = `
      SELECT p.id, p.sku, p.slug, p.name_ar, p.name_en, 
             p.selling_price, p.regular_price, p.currency,
             c.id AS category_id, c.name_ar AS category_name_ar, c.name_en AS category_name_en, c.slug AS category_slug,
             b.id AS brand_id, b.name AS brand_name, b.slug AS brand_slug,
             pi.cloudinary_url, pi.width, pi.height
      FROM products p
      JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.image_order = 1
      ${whereString}
      ORDER BY p.id DESC
      ${limitString}
    `;

    const result = await db.query(queryStr, params);

    let hasMore = false;
    let rows = result.rows;
    if (rows.length > parsedLimit) {
      hasMore = true;
      rows = rows.slice(0, parsedLimit);
    }

    const products = rows.map(row => ({
      id: row.id,
      sku: row.sku,
      slug: row.slug,
      name_ar: row.name_ar,
      name_en: row.name_en,
      selling_price: row.selling_price,
      regular_price: row.regular_price,
      currency: row.currency,
      category: {
        id: row.category_id,
        name_ar: row.category_name_ar,
        name_en: row.category_name_en,
        slug: row.category_slug
      },
      brand: row.brand_id ? {
        id: row.brand_id,
        name: row.brand_name,
        slug: row.brand_slug
      } : null,
      primary_image: row.cloudinary_url ? {
        url: row.cloudinary_url,
        width: row.width,
        height: row.height
      } : null
    }));

    let nextCursor = null;
    if (hasMore && products.length > 0) {
      const lastId = products[products.length - 1].id;
      nextCursor = encodeCursor(lastId);
    }

    res.json({
      products,
      next_cursor: nextCursor
    });

  } catch (error) {
    console.error('[Products] List error:', error.message);
    res.status(500).json({ error: true, message: 'Internal Server Error' });
  }
});

// GET /api/products/:slug
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    const pResult = await db.query(`
      SELECT p.id, p.sku, p.slug, p.name_ar, p.name_en, 
             p.short_description_ar, p.short_description_en,
             p.details_ar, p.details_en,
             p.source_price, p.regular_price, p.selling_price, p.currency,
             c.id AS category_id, c.name_ar AS category_name_ar, c.name_en AS category_name_en, c.slug AS category_slug,
             b.id AS brand_id, b.name AS brand_name, b.slug AS brand_slug
      FROM products p
      JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.slug = $1 AND p.status = 'ACTIVE' AND c.status = 'ACTIVE'
    `, [slug]);

    if (pResult.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Product not found' });
    }

    const productRow = pResult.rows[0];

    const iResult = await db.query(`
      SELECT cloudinary_url, image_order, width, height
      FROM product_images
      WHERE product_id = $1
      ORDER BY image_order ASC
    `, [productRow.id]);

    const images = iResult.rows
      .filter(img => img.cloudinary_url) // omit failed unuploaded images entirely if needed, or include them with null. Let's return only valid ones or allow nulls since Phase 1 gracefully fallback to null.
      .map(img => ({
        url: img.cloudinary_url,
        order: img.image_order,
        width: img.width,
        height: img.height
      }));

    const product = {
      id: productRow.id,
      sku: productRow.sku,
      slug: productRow.slug,
      name_ar: productRow.name_ar,
      name_en: productRow.name_en,
      short_description_ar: productRow.short_description_ar,
      short_description_en: productRow.short_description_en,
      details_ar: productRow.details_ar,
      details_en: productRow.details_en,
      source_price: productRow.source_price,
      regular_price: productRow.regular_price,
      selling_price: productRow.selling_price,
      currency: productRow.currency,
      category: {
        id: productRow.category_id,
        name_ar: productRow.category_name_ar,
        name_en: productRow.category_name_en,
        slug: productRow.category_slug
      },
      brand: productRow.brand_id ? {
        id: productRow.brand_id,
        name: productRow.brand_name,
        slug: productRow.brand_slug
      } : null,
      images
    };

    res.json({ product });

  } catch (error) {
    console.error('[Products] Detail error:', error.message);
    res.status(500).json({ error: true, message: 'Internal Server Error' });
  }
});

module.exports = router;
