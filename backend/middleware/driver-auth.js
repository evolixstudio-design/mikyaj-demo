const jwt = require('jsonwebtoken');
const { pool } = require('../db');

async function requireDriverAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Missing or invalid Authorization header.' });
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.ADMIN_JWT_SECRET;
  
  if (!secret) {
    console.error('CRITICAL: ADMIN_JWT_SECRET is not configured in environment variables.');
    return res.status(500).json({ error: 'Internal server error during authentication.' });
  }

  try {
    const payload = jwt.verify(token, secret);
    
    if (payload.role !== 'DRIVER') {
      return res.status(403).json({ error: 'Insufficient permissions. Driver role required.' });
    }

    // Verify driver is still active in database
    const { rows } = await pool.query('SELECT id, status, name, email FROM drivers WHERE id = $1', [payload.id]);
    
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Driver account no longer exists.' });
    }
    
    const driver = rows[0];
    if (driver.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Driver account is inactive.' });
    }

    // Attach verified driver to request
    req.driver = {
      id: driver.id,
      email: driver.email,
      name: driver.name,
      role: 'DRIVER'
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Authentication token expired.' });
    }
    return res.status(401).json({ error: 'Invalid authentication token.' });
  }
}

module.exports = {
  requireDriverAuth
};
