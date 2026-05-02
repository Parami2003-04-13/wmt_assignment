require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const User = require('./models/User');
const Stall = require('./models/Stall');
const Meal = require('./models/Meal');
const { connectDB } = require('./db');
const { authUserFromRequest, stallCanManageMeals } = require('./utils/authRequest');

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

// Update profile (minimal; aligns with Expo-stored user after login)
app.patch('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const { name, firstName, lastName } = req.body;
    const updateFields = {};

    if (typeof name === 'string' && name.trim() !== '') {
      updateFields.name = name.trim();
    }
    if (typeof firstName === 'string') updateFields.firstName = firstName.trim();
    if (typeof lastName === 'string') updateFields.lastName = lastName.trim();
    const nicRaw = req.body.nic;
    if (nicRaw !== undefined) {
      const nicTrim =
        typeof nicRaw === 'string' && nicRaw.trim() !== '' ? nicRaw.trim() : undefined;
      if (nicTrim !== undefined) updateFields.nic = nicTrim;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'phone')) {
      const p = req.body.phone;
      if (p === null || p === '') {
        updateFields.phone = null;
      } else if (typeof p === 'string') {
        const t = p.trim();
        updateFields.phone = t === '' ? null : t;
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: 'Nothing to update' });
    }

    const user = await User.findByIdAndUpdate(id, { $set: updateFields }, { new: true, runValidators: true }).select(
      '_id email role name firstName lastName nic phone'
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        nic: user.nic,
        phone: user.phone || null,
      },
    });
  } catch (err) {
    console.error('User update error:', err);
    if (err.code === 11000 && err.keyPattern) {
      const field = Object.keys(err.keyPattern)[0];
      if (field === 'nic') return res.status(400).json({ message: 'This NIC is already registered.' });
      return res.status(400).json({ message: 'Some of this information is already in use.' });
    }
    if (err.name === 'ValidationError' && err.errors) {
      const first = Object.values(err.errors)[0];
      const msg = typeof first?.message === 'string' ? first.message : 'Invalid data.';
      return res.status(400).json({ message: msg });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const stallDocs = await Stall.find({ manager: id }).select('_id');
    const stallIds = stallDocs.map((s) => s._id);
    await Meal.deleteMany({ stall: { $in: stallIds } });
    if (stallIds.length > 0) {
      await User.deleteMany({ role: 'stall staff', staffStallId: { $in: stallIds } });
    }
    await Stall.deleteMany({ manager: id });
    await User.findByIdAndDelete(id);

    res.json({ message: 'Account and related stall data deleted' });
  } catch (err) {
    console.error('User delete error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

const authRoutes = require('./routes/authRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const stallRoutes = require('./routes/stallRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const supportTicketRoutes = require('./routes/supportTicketRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const pendingBankRoutes = require('./routes/pendingBankRoutes');
const mealRoutes = require('./routes/mealRoutes');

app.use('/api/auth', authRoutes);
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