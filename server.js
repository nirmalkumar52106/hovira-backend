

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');
;

const app = express();

app.disable('x-powered-by');
app.use(helmet());



const origins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://hovira-cosmetics.netlify.app",
  "https://hoviraskincare.com",
  "https://www.hoviraskincare.com",
  "https://radiant-kelpie-26709c.netlify.app",
  "https://adminhovira.netlify.app"
];

const corsOptions = {
  origin(origin, callback) {
    if (!origin || origins.includes(origin)) {
      return callback(null, true);
    }

    console.error("Blocked CORS origin:", origin);
    return callback(new Error(`Blocked CORS origin: ${origin}`));
  },

  credentials: true,

  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Accept",
  ],
};

app.use(cors(corsOptions));



app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

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


// Health Check
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'HOVIRA Cosmetics API',
    timestamp: new Date().toISOString(),
  });
});

// Protected SMTP diagnostic; does not depend on MongoDB.
app.use('/api/email-test', require('./routes/emailTestRoutes'));

// MongoDB Connection Middleware
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    next(err);
  }
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
app.use("/api/newsletter", require("./routes/newsletterRoutes"));
app.use("/api/admin/newsletter", require("./routes/adminNewsletterRoutes"));
app.use(
  "/api/admin/newsletter/campaigns",
  require(
  "./routes/adminNewsletterCampaignRoutes"
)
);

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