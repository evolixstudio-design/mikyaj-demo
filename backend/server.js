require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

// Routers
const healthRouter = require('./routes/health');
const productsRouter = require('./routes/products');
const categoriesRouter = require('./routes/categories');
const brandsRouter = require('./routes/brands');
const checkoutRouter = require('./routes/checkout');
const paymentRouter = require('./routes/payment');
const webhookRouter = require('./routes/webhook');
const adminAuthRouter = require('./routes/admin-auth');
const adminOrdersRouter = require('./routes/admin-orders');
const adminDriversRouter = require('./routes/admin-drivers');
const adminRefundsRouter = require('./routes/admin-refunds');
const driverAuthRouter = require('./routes/driver-auth');
const driverOrdersRouter = require('./routes/driver-orders');
const { requireAdminAuth } = require('./middleware/admin-auth');

// Setup S3 (Preserved for backwards compatibility if needed)
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const app = express();
const port = process.env.PORT || 3000;

// Security & CORS
const frontendUrl = process.env.FRONTEND_URL || '*';
app.use(cors({
  origin: frontendUrl === '*' ? '*' : [frontendUrl, 'http://localhost:3000', 'http://127.0.0.1:3000']
}));

// Basic Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

app.use(express.json());

// API Routes
app.use('/api/health', healthRouter);
app.use('/api/products', productsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/brands', brandsRouter);
app.use('/api/checkout', checkoutRouter);
app.use('/api/payment', paymentRouter);
app.use('/api/webhook', webhookRouter);

// Admin Routes
app.use('/api/admin/auth', adminAuthRouter);
app.use('/api/admin/orders', requireAdminAuth, adminOrdersRouter);
app.use('/api/admin/drivers', adminDriversRouter);
app.use('/api/admin', adminRefundsRouter); // This handles /api/admin/orders/.../refunds and /api/admin/refunds

// Driver Routes
app.use('/api/driver/auth', driverAuthRouter);
app.use('/api/driver/orders', driverOrdersRouter);

// Route /admin and /admin/ to Admin Login page
app.get(['/admin', '/admin/', '/admin/login'], (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/mikyaj-demo/admin/login.html'));
});

// Serve frontend statically
app.use(express.static(path.join(__dirname, '../frontend/mikyaj-demo')));

// Proxy images from S3 (Preserved for backwards compatibility)
app.get(/^\/api\/images\/(.+)$/, async (req, res) => {
  const key = req.params[0];
  try {
    const data = await s3Client.send(new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key
    }));
    res.setHeader('Content-Type', data.ContentType || 'image/webp');
    data.Body.pipe(res);
  } catch (err) {
    res.status(404).end();
  }
});

// Serve frontend for local development
app.use(express.static(path.join(__dirname, '../frontend/mikyaj-demo')));
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/mikyaj-demo', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
