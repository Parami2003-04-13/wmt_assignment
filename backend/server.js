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

app.use('/api/auth', authRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/stalls', stallRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/support-tickets', supportTicketRoutes);
app.use('/api/notifications', notificationRoutes);

// --- Meal Routes ---

// Create Meal
app.post('/api/meals', async (req, res) => {
  const { name, description, price, quantity, category, image, stallId } = req.body;

  if (!name || !description || price === undefined || quantity === undefined || !stallId) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  if (!image || !String(image).trim()) {
    return res.status(400).json({ message: 'Meal photo is required.' });
  }

  try {
    const auth = await authUserFromRequest(req);
    if (auth) {
      const { ok } = await stallCanManageMeals(stallId, auth._id.toString(), auth.role, auth.staffStallId);
      if (!ok) {
        return res.status(403).json({ message: 'You cannot add meals to this stall.' });
      }
    }

    const newMeal = new Meal({
      name,
      description,
      price,
      quantity,
      category,
      image: String(image).trim(),
      stall: stallId,
    });
    
    await newMeal.save();
    res.status(201).json(newMeal);
  } catch (err) {
    console.error('Meal creation error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get meals by Stall
app.get('/api/meals/stall/:stallId', async (req, res) => {
  try {
    const meals = await Meal.find({ stall: req.params.stallId });
    res.json(meals);
  } catch (err) {
    console.error('Fetch meals error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a single meal by ID
app.get('/api/meals/:id', async (req, res) => {
  try {
    const meal = await Meal.findById(req.params.id);
    if (!meal) return res.status(404).json({ message: 'Meal not found' });
    res.json(meal);
  } catch (err) {
    console.error('Fetch meal error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// Update Meal
app.patch('/api/meals/:id', async (req, res) => {
  try {
    const existing = await Meal.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Meal not found' });

    const auth = await authUserFromRequest(req);
    if (auth) {
      const stallId = existing.stall.toString();
      const { ok } = await stallCanManageMeals(stallId, auth._id.toString(), auth.role, auth.staffStallId);
      if (!ok) {
        return res.status(403).json({ message: 'You cannot edit this meal.' });
      }
    }

    const { name, description, price, quantity, category, image } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description;
    if (price !== undefined) update.price = price;
    if (quantity !== undefined) update.quantity = quantity;
    if (category !== undefined) update.category = category;
    if (image !== undefined) update.image = image;

    const nextImage =
      update.image !== undefined ? String(update.image).trim() : String(existing.image || '').trim();
    if (!nextImage) {
      return res.status(400).json({ message: 'Meal photo is required.' });
    }
    if (update.image !== undefined) {
      update.image = nextImage;
    }

    const updatedMeal = await Meal.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    res.json(updatedMeal);
  } catch (err) {
    console.error('Update meal error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete Meal
app.delete('/api/meals/:id', async (req, res) => {
  try {
    const candidate = await Meal.findById(req.params.id);
    if (!candidate) return res.status(404).json({ message: 'Meal not found' });

    const auth = await authUserFromRequest(req);
    if (auth) {
      const stallId = candidate.stall.toString();
      const { ok } = await stallCanManageMeals(stallId, auth._id.toString(), auth.role, auth.staffStallId);
      if (!ok) {
        return res.status(403).json({ message: 'You cannot remove this meal.' });
      }
    }

    const deletedMeal = await Meal.findByIdAndDelete(req.params.id);
    if (!deletedMeal) return res.status(404).json({ message: 'Meal not found' });
    res.json({ message: 'Meal deleted successfully' });
  } catch (err) {
    console.error('Delete meal error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all meals (for Explore/Discovery)
app.get('/api/meals', async (req, res) => {
  try {
    const meals = await Meal.find().populate('stall', 'name');
    res.json(meals);
  } catch (err) {
    console.error('Fetch all meals error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

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