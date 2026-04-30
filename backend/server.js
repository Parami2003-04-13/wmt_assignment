require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Stall = require('./models/Stall');
const Meal = require('./models/Meal');
const { 
  sendNotificationEmail, 
  getApproveEmailTemplate, 
  getRejectEmailTemplate,
  getReviewEmailTemplate,
  getAdminNotificationTemplate
} = require('./utils/emailService');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const sendEmailInBackground = (to, subject, htmlContent) => {
  sendNotificationEmail(to, subject, htmlContent).catch((error) => {
    console.error('Background email error:', error);
  });
};

// Request logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
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
const REGISTER_ROLES = ['user', 'stall owner', 'stall manager', 'admin'];

app.post('/api/auth/register', async (req, res) => {
  const { email, password, role, name } = req.body;
  const emailNorm = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const nameNorm = typeof name === 'string' ? name.trim() : '';
  const nicRaw = req.body.nic;
  const nicNorm =
    typeof nicRaw === 'string' && nicRaw.trim() !== '' ? nicRaw.trim() : undefined;

  if (!emailNorm || !password || !nameNorm) {
    return res.status(400).json({ message: 'Please provide name, email and password' });
  }

  const resolvedRole = role || 'user';
  if (!REGISTER_ROLES.includes(resolvedRole)) {
    return res.status(400).json({
      message: `Invalid role. Allowed: ${REGISTER_ROLES.join(', ')}`
    });
  }

  try {
    const userExists = await User.findOne({ email: emailNorm });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const newUser = new User({
      email: emailNorm,
      password, // hashed automatically by schema middleware
      role: resolvedRole,
      name: nameNorm,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      ...(nicNorm !== undefined ? { nic: nicNorm } : {})
    });

    await newUser.save();

    res.status(201).json({ message: 'User created successfully' });

  } catch (err) {
    console.error('Registration error:', err);
    if (err.code === 11000 && err.keyPattern) {
      const dupField = Object.keys(err.keyPattern)[0];
      if (dupField === 'email') {
        return res.status(400).json({ message: 'An account with this email already exists.' });
      }
      if (dupField === 'nic') {
        return res.status(400).json({ message: 'This NIC is already registered.' });
      }
      return res.status(400).json({ message: 'Some of this information is already in use.' });
    }
    if (err.name === 'ValidationError' && err.errors) {
      const first = Object.values(err.errors)[0];
      const msg =
        typeof first?.message === 'string' ? first.message : 'Invalid registration data.';
      return res.status(400).json({ message: msg });
    }
    res.status(500).json({ message: 'Server error' });
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

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: 'Nothing to update' });
    }

    const user = await User.findByIdAndUpdate(id, { $set: updateFields }, { new: true, runValidators: true }).select(
      '_id email role name firstName lastName nic'
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
    await Stall.deleteMany({ manager: id });
    await User.findByIdAndDelete(id);

    res.json({ message: 'Account and related stall data deleted' });
  } catch (err) {
    console.error('User delete error:', err);
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
      profilePhoto, coverPhoto, manager: managerId,
      approvedDocument: req.body.approvedDocument,
      isApproved: false 
    });
    
    await newStall.save();

    res.status(201).json(newStall);

    // Notify Owner & Admin without blocking the saved response.
    (async () => {
      try {
        const owner = await User.findById(managerId);
        if (owner && owner.email) {
          // To Owner
          const ownerMsg = getReviewEmailTemplate(owner.name, name);
          sendEmailInBackground(owner.email, `Stall Under Review: ${name}`, ownerMsg);

          // To Admin (Default to EMAIL_USER)
          const adminEmail = process.env.EMAIL_USER;
          if (adminEmail) {
            const adminMsg = getAdminNotificationTemplate(owner.name, name);
            sendEmailInBackground(adminEmail, `ACTION REQUIRED: New Stall Request`, adminMsg);
          }
        }
      } catch (emailLookupError) {
        console.error('Stall notification lookup error:', emailLookupError);
      }
    })();
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

// Get Stall by ID
app.get('/api/stalls/:id', async (req, res) => {
  try {
    const stall = await Stall.findById(req.params.id);
    if (!stall) return res.status(404).json({ message: 'Stall not found' });
    res.json(stall);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get All Stalls (for Admin)
app.get('/api/stalls', async (req, res) => {
  try {
    const stalls = await Stall.find().populate('manager', 'name email nic');
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

// Approve Stall
app.patch('/api/stalls/:id/approve', async (req, res) => {
  try {
    const stall = await Stall.findByIdAndUpdate(req.params.id, { isApproved: true }, { new: true })
      .populate('manager', 'email name');
    
    if (stall && stall.manager && stall.manager.email) {
      const emailContent = getApproveEmailTemplate(stall.manager.name, stall.name);
      sendEmailInBackground(stall.manager.email, `Stall Approved: ${stall.name}`, emailContent);
    }

    res.json(stall);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update stall details (e.g. stall manager corrects phone / address before or after approval)
app.patch('/api/stalls/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid stall id' });
    }

    const update = {};
    if (typeof req.body.name === 'string' && req.body.name.trim()) update.name = req.body.name.trim();
    if (typeof req.body.address === 'string' && req.body.address.trim()) update.address = req.body.address.trim();
    if (typeof req.body.phone === 'string' && req.body.phone.trim()) update.phone = req.body.phone.trim();
    if (typeof req.body.description === 'string') update.description = req.body.description;
    if (typeof req.body.latitude === 'number' && !Number.isNaN(req.body.latitude)) update.latitude = req.body.latitude;
    if (typeof req.body.longitude === 'number' && !Number.isNaN(req.body.longitude)) update.longitude = req.body.longitude;

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const stall = await Stall.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }).populate(
      'manager',
      'name email nic'
    );

    if (!stall) return res.status(404).json({ message: 'Stall not found' });
    res.json(stall);
  } catch (err) {
    console.error('Stall update error:', err);
    if (err.name === 'ValidationError' && err.errors) {
      const first = Object.values(err.errors)[0];
      return res.status(400).json({ message: typeof first?.message === 'string' ? first.message : 'Invalid data.' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete Stall (Reject)
app.delete('/api/stalls/:id', async (req, res) => {
  try {
    const stall = await Stall.findById(req.params.id).populate('manager', 'email name');
    
    if (stall && stall.manager && stall.manager.email) {
      const emailContent = getRejectEmailTemplate(stall.manager.name, stall.name);
      sendEmailInBackground(stall.manager.email, `Registration Rejected: ${stall.name}`, emailContent);
    }

    await Meal.deleteMany({ stall: req.params.id });
    await Stall.findByIdAndDelete(req.params.id);
    res.json({ message: 'Stall deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Meal Routes ---

// Create Meal
app.post('/api/meals', async (req, res) => {
  const { name, description, price, quantity, image, stallId } = req.body;

  if (!name || !description || !price || !quantity || !stallId) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const newMeal = new Meal({
      name, description, price, quantity, image, stall: stallId
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

// Update Meal
app.patch('/api/meals/:id', async (req, res) => {
  try {
    const updatedMeal = await Meal.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedMeal) return res.status(404).json({ message: 'Meal not found' });
    res.json(updatedMeal);
  } catch (err) {
    console.error('Update meal error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete Meal
app.delete('/api/meals/:id', async (req, res) => {
  try {
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
