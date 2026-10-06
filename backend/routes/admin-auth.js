const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

// POST /api/admin/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Lookup user
    const { rows } = await pool.query(
      'SELECT id, email, password_hash, role, status, session_version FROM admin_users WHERE email = $1',
      [String(email).trim().toLowerCase()]
    );

    if (rows.length === 0) {
      // Generic error for security
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const admin = rows[0];

    // Check status
    if (admin.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'Invalid email or password.' }); // Keep generic
    }

    // Verify password
    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Generate JWT
    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret) {
      console.error('CRITICAL: ADMIN_JWT_SECRET is not configured in environment variables.');
      return res.status(500).json({ error: 'Internal server error.' });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role, session_version: admin.session_version },
      secret,
      { expiresIn: '12h' } // Typical admin session duration
    );

    res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role
      }
    });

  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
