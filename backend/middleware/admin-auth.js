const jwt = require('jsonwebtoken');

function requireAdminAuth(req, res, next) {
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
    
    if (payload.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Insufficient permissions. Admin role required.' });
    }

    // Attach verified admin to request
    req.admin = {
      id: payload.id,
      email: payload.email,
      role: payload.role
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
  requireAdminAuth
};
