const bcrypt = require('bcryptjs');
const { pool } = require('../db');

async function createDriver(adminId, { name, phone, email, password, status = 'ACTIVE' }) {
  if (!name || !phone || !email || !password) {
    throw new Error('MISSING_FIELDS');
  }

  // Ensure email uniqueness
  const { rows: existing } = await pool.query('SELECT id FROM drivers WHERE email = $1', [email]);
  if (existing.length > 0) {
    throw new Error('DUPLICATE_EMAIL');
  }

  const hash = await bcrypt.hash(password, 10);

  const { rows } = await pool.query(`
    INSERT INTO drivers (name, phone, email, password_hash, status)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, name, phone, email, status, created_at
  `, [name, phone, email, hash, status]);

  return rows[0];
}

async function listDrivers() {
  const { rows } = await pool.query(`
    SELECT 
      d.id, d.name, d.phone, d.email, d.status, d.created_at,
      (
        SELECT COUNT(*) 
        FROM order_driver_assignments oda 
        WHERE oda.driver_id = d.id AND oda.status = 'ACTIVE'
      ) as active_assignment_count
    FROM drivers d
    ORDER BY d.created_at DESC
  `);
  
  return rows.map(r => ({
    ...r,
    active_assignment_count: parseInt(r.active_assignment_count, 10)
  }));
}

async function changeDriverStatus(driverId, newStatus) {
  if (!['ACTIVE', 'INACTIVE'].includes(newStatus)) {
    throw new Error('INVALID_STATUS');
  }

  const { rows } = await pool.query(`
    UPDATE drivers 
    SET status = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING id, name, status
  `, [newStatus, driverId]);

  if (rows.length === 0) {
    throw new Error('DRIVER_NOT_FOUND');
  }

  return rows[0];
}

async function loginDriver(email, password) {
  const { rows } = await pool.query('SELECT id, name, phone, email, password_hash, status FROM drivers WHERE email = $1', [email]);
  
  if (rows.length === 0) {
    throw new Error('INVALID_CREDENTIALS');
  }
  
  const driver = rows[0];
  
  if (driver.status !== 'ACTIVE') {
    throw new Error('DRIVER_INACTIVE');
  }

  const isMatch = await bcrypt.compare(password, driver.password_hash);
  if (!isMatch) {
    throw new Error('INVALID_CREDENTIALS');
  }

  return {
    id: driver.id,
    name: driver.name,
    phone: driver.phone,
    email: driver.email,
    role: 'DRIVER'
  };
}

module.exports = {
  createDriver,
  listDrivers,
  changeDriverStatus,
  loginDriver
};
