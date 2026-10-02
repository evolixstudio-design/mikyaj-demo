require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('./db');

async function seedAdmin() {
  try {
    const email = 'admin@mikyaj.com';
    const password = 'admin_password_123';
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);

    await pool.query(
      `INSERT INTO admin_users (email, password_hash, role, status)
       VALUES ($1, $2, 'ADMIN', 'ACTIVE')
       ON CONFLICT (email) DO UPDATE SET password_hash = $2`,
      [email, hash]
    );

    console.log('Admin user seeded successfully. email:', email);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

seedAdmin();
