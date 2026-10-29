// require('dotenv').config();
// const express = require('express'); const cors = require('cors'); const helmet = require('helmet'); const morgan = require('morgan');
// const connectDB = require('./config/db'); const { notFound, errorHandler } = require('./middleware/errorHandler');
// const app = express();
// app.disable('x-powered-by'); app.use(helmet());
// const origins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map(x => x.trim());
// app.use(cors({ origin(origin, callback) { if (!origin || origins.includes('*') || origins.includes(origin)) return callback(null, true); return callback(new Error('CORS origin not allowed.')); }, credentials: true }));
// app.use(express.json({ limit: '2mb' })); app.use(express.urlencoded({ extended: true, limit: '2mb' }));
// if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));
// app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'HOVIRA Cosmetics API', timestamp: new Date().toISOString() }));
// app.use('/api/auth', require('./routes/authRoutes'));
// app.use('/api/products', require('./routes/productRoutes'));
// app.use('/api/customers', require('./routes/customerRoutes'));
// app.use('/api/coupons', require('./routes/couponRoutes'));
// app.use('/api/orders', require('./routes/orderRoutes'));
// app.use('/api/admin', require('./routes/adminRoutes'));
// app.use(notFound); app.use(errorHandler);
// const PORT = Number(process.env.PORT || 5000);
// connectDB().then(() => app.listen(PORT, () => console.log(`HOVIRA API running on http://localhost:${PORT}`))).catch(err => { console.error('Failed to start API:', err.message); process.exit(1); });


require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.disable('x-powered-by');
app.use(helmet());



app.use(cors(origin = "*"))

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Public health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'HOVIRA Cosmetics API',
    timestamp: new Date().toISOString(),
  });
});

// Connect to MongoDB before handling database-dependent routes
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    next(err);
  }
});

// Existing API routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/coupons', require('./routes/couponRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

app.use(notFound);
app.use(errorHandler);

// Local development only
if (process.env.NODE_ENV !== 'production') {
  const PORT = Number(process.env.PORT || 5000);

  app.listen(PORT, () => {
    console.log(`HOVIRA API running on port ${PORT}`);
  });
}

// Export Express app for Vercel
module.exports = app;