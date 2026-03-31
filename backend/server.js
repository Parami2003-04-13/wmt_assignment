const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const User = require('./models/User');
const Stall = require('./models/Stall');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// PORT
const PORT = process.env.PORT || 5000;

// Connect to MongoDB Atlas
const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
  console.error('MONGO_URI is not defined in .env');
  process.exit(1);
}

mongoose.connect(mongoUri)
  .then(() => console.log('Successfully connected to MongoDB Atlas!'))
  .catch((err) => console.error('Error connecting to MongoDB:', err));

// --- Auth Routes ---

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide email and password' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'supersecretkey',
      { expiresIn: '1h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Register (for testing, will be useful for instructions)
app.post('/api/auth/register', async (req, res) => {
  const { email, password, role, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ message: 'Please provide name, email and password' });
  }

  try {
    const userExists = await User.findOne({ email: email.toLowerCase() });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const newUser = new User({
      email,
      password, // hashed automatically by schema middleware
      role: role || 'user',
      name
    });

    await newUser.save();

    res.status(201).json({ message: 'User created successfully' });

  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Stall Routes ---

// Create Stall
app.post('/api/stalls', async (req, res) => {
  const { name, address, phone, description, latitude, longitude, profilePhoto, coverPhoto, managerId } = req.body;

  if (!name || !address || !latitude || !longitude || !managerId) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const newStall = new Stall({
      name, address, phone, description, latitude, longitude,
      profilePhoto, coverPhoto, manager: managerId
    });
    await newStall.save();
    res.status(201).json(newStall);
  } catch (err) {
    console.error('Stall creation error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Stalls by Manager
app.get('/api/stalls/manager/:managerId', async (req, res) => {
  try {
    const stalls = await Stall.find({ manager: req.params.managerId });
    res.json(stalls);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Stall Status
app.patch('/api/stalls/:id/status', async (req, res) => {
  const { status } = req.body;
  try {
    const stall = await Stall.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json(stall);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
