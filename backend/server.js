require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
  res.type('text/plain').send('campusBite backend server running');
});

// PORT
const PORT = process.env.PORT || 5000;

// Connect to MongoDB Atlas
const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
  console.error('MONGO_URI is not defined in .env');
  // Avoid process.exit on Vercel — it marks every invocation as FUNCTION_INVOCATION_FAILED.
  if (!process.env.VERCEL) {
    process.exit(1);
  }
}

// Await connect per request — avoids flaky parallel connects & stale pools on serverless (Vercel).
app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

app.use(async (req, res, next) => {
  const url = req.originalUrl || '';
  if (url === '/api/health' || url.startsWith('/api/health?')) {
    return next();
  }
  if (!url.startsWith('/api')) {
    return next();
  }
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection error:', err);
    res.status(503).json({ message: 'Database temporarily unavailable' });
  }
});

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const stallRoutes = require('./routes/stallRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const supportTicketRoutes = require('./routes/supportTicketRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const pendingBankRoutes = require('./routes/pendingBankRoutes');
const mealRoutes = require('./routes/mealRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/stalls', stallRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/support-tickets', supportTicketRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/pending-bank-transfers', pendingBankRoutes);
app.use('/api/meals', mealRoutes);



// Removed old Order Routes - now handled in routes/orderRoutes.js

// Vercel serverless invokes this file as a module — do not bind a listener there.

module.exports = app;
if (!process.env.VERCEL && require.main === module) {
  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    try {
      await connectDB();
    } catch (err) {
      console.error('Initial database connection failed:', err);
    }
  });
}