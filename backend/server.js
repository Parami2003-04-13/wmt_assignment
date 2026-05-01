require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Stall = require('./models/Stall');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

async function authUserFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  try {
    const payload = jwt.verify(authHeader.slice('Bearer '.length).trim(), JWT_SECRET);
    if (!payload || !mongoose.Types.ObjectId.isValid(payload.id)) return null;
    const user = await User.findById(payload.id).select('_id role staffStallId');
    return user;
  } catch {
    return null;
  }
}

function isStallOwnerUser(stallDoc, ownerUserDoc) {
  if (!ownerUserDoc || !stallDoc) return false;
  return stallDoc.manager.toString() === ownerUserDoc._id.toString();
}

async function stallCanManageMeals(stallId, actingUserId, actingRole, staffStallId) {
  const stall = await Stall.findById(stallId);
  if (!stall) return { ok: false, stall: null };
  const sid = stall._id.toString();
  const ownerMatch = stall.manager.toString() === actingUserId;
  const staffMatch = actingRole === 'stall staff' && staffStallId && sid === staffStallId.toString();
  if (actingRole === 'stall owner' && ownerMatch) return { ok: true, stall };
  if (actingRole === 'stall staff' && staffMatch) return { ok: true, stall };
  return { ok: false, stall };
}

const Meal = require('./models/Meal');
const { connectDB } = require('./db');
const {
  normalizeTimeInput,
  deriveStatusFromHours,
  persistAutoStatusForStall,
} = require('./utils/businessHours');
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
  // Avoid process.exit on Vercel — it marks every invocation as FUNCTION_INVOCATION_FAILED.
  if (!process.env.VERCEL) {
    process.exit(1);
  }
}

// Await connect per request — avoids flaky parallel connects & stale pools on serverless (Vercel).
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
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
        ...(user.phone ? { phone: user.phone } : {}),
        ...(user.staffStallId ? { staffStallId: user.staffStallId.toString() } : {}),
      },
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

// Import Review Routes
const reviewRoutes = require('./routes/reviewRoutes');

// Use Review Routes
app.use('/api/reviews', reviewRoutes);

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
    let stalls = await Stall.find({ manager: req.params.managerId });
    for (const s of stalls) {
      await persistAutoStatusForStall(Stall, s);
    }
    stalls = await Stall.find({ manager: req.params.managerId });
    res.json(stalls);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Stall staff (menu + manual open/closed; no stall profile / hours / phone / images via API) ---
app.post('/api/stalls/:stallId/staff', async (req, res) => {
  const auth = await authUserFromRequest(req);
  if (!auth || auth.role !== 'stall owner') {
    return res.status(403).json({ message: 'Only stall owners can add staff.' });
  }
  const { stallId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(stallId)) {
    return res.status(400).json({ message: 'Invalid stall id' });
  }
  const stall = await Stall.findById(stallId);
  if (!stall) return res.status(404).json({ message: 'Stall not found' });
  if (!isStallOwnerUser(stall, auth)) {
    return res.status(403).json({ message: 'You can only add staff to your own stalls.' });
  }

  const { name, email, password } = req.body;
  const emailNorm = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const nameNorm = typeof name === 'string' ? name.trim() : '';
  const passStr = password != null ? String(password) : '';
  if (!emailNorm || !nameNorm || passStr.length < 6) {
    return res.status(400).json({ message: 'Provide name, email, and a password (at least 6 characters).' });
  }

  try {
    const exists = await User.findOne({ email: emailNorm });
    if (exists) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }
    const nu = new User({
      email: emailNorm,
      password: passStr,
      name: nameNorm,
      role: 'stall staff',
      staffStallId: stallId,
    });
    await nu.save();
    res.status(201).json({
      id: nu._id.toString(),
      email: nu.email,
      name: nu.name,
      role: nu.role,
      staffStallId: stall._id.toString(),
    });
  } catch (err) {
    console.error('Add staff error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/stalls/:stallId/staff', async (req, res) => {
  const auth = await authUserFromRequest(req);
  if (!auth || auth.role !== 'stall owner') {
    return res.status(403).json({ message: 'Only stall owners can list staff.' });
  }
  const { stallId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(stallId)) {
    return res.status(400).json({ message: 'Invalid stall id' });
  }
  const stall = await Stall.findById(stallId);
  if (!stall) return res.status(404).json({ message: 'Stall not found' });
  if (!isStallOwnerUser(stall, auth)) {
    return res.status(403).json({ message: 'Not your stall.' });
  }
  try {
    const list = await User.find({ role: 'stall staff', staffStallId: stall._id })
      .select('_id name email createdAt')
      .sort({ createdAt: 1 });
    res.json(
      list.map((u) => ({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        createdAt: u.createdAt,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/stalls/:stallId/staff/:userId', async (req, res) => {
  const auth = await authUserFromRequest(req);
  if (!auth || auth.role !== 'stall owner') {
    return res.status(403).json({ message: 'Only stall owners can remove staff.' });
  }
  const { stallId, userId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(stallId) || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Invalid id' });
  }
  const stall = await Stall.findById(stallId);
  if (!stall) return res.status(404).json({ message: 'Stall not found' });
  if (!isStallOwnerUser(stall, auth)) {
    return res.status(403).json({ message: 'Not your stall.' });
  }
  try {
    const target = await User.findById(userId);
    if (
      !target ||
      target.role !== 'stall staff' ||
      !target.staffStallId ||
      target.staffStallId.toString() !== stallId
    ) {
      return res.status(404).json({ message: 'Staff member not found for this stall.' });
    }
    await User.findByIdAndDelete(userId);
    res.json({ message: 'Staff removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Stall by ID
app.get('/api/stalls/:id', async (req, res) => {
  try {
    let stall = await Stall.findById(req.params.id);
    if (!stall) return res.status(404).json({ message: 'Stall not found' });
    stall = await persistAutoStatusForStall(Stall, stall);
    res.json(stall);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get All Stalls (for Admin)
app.get('/api/stalls', async (req, res) => {
  try {
    let stalls = await Stall.find().populate('manager', 'name email nic');
    for (const s of stalls) {
      await persistAutoStatusForStall(Stall, s);
    }
    stalls = await Stall.find().populate('manager', 'name email nic');
    res.json(stalls);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Stall Status
app.patch('/api/stalls/:id/status', async (req, res) => {
  const { status } = req.body;
  if (status !== 'Open' && status !== 'Closed') {
    return res.status(400).json({ message: 'Invalid status' });
  }

  try {
    const sid = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(sid)) {
      return res.status(400).json({ message: 'Invalid stall id' });
    }

    const pre = await Stall.findById(sid);
    if (!pre) return res.status(404).json({ message: 'Stall not found' });

    const auth = await authUserFromRequest(req);
    if (auth) {
      const platform = auth.role === 'stall manager' || auth.role === 'admin';
      const ownerOk = auth.role === 'stall owner' && isStallOwnerUser(pre, auth);
      const staffOk =
        auth.role === 'stall staff' && auth.staffStallId && auth.staffStallId.toString() === sid;
      if (!(platform || ownerOk || staffOk)) {
        return res.status(403).json({ message: 'Not authorised to change this stall status.' });
      }
    }

    const stall = await Stall.findByIdAndUpdate(
      sid,
      { status, hoursAuto: false },
      { new: true }
    );
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

    const stallPre = await Stall.findById(id);
    if (!stallPre) return res.status(404).json({ message: 'Stall not found' });

    const auth = await authUserFromRequest(req);
    if (auth) {
      if (auth.role === 'stall staff') {
        return res.status(403).json({
          message: 'Staff cannot change description, hours, phone, stall images, or address.',
        });
      }
      const platformOk = auth.role === 'stall manager' || auth.role === 'admin';
      const ownerOk = auth.role === 'stall owner' && isStallOwnerUser(stallPre, auth);
      if (!(platformOk || ownerOk)) {
        return res.status(403).json({ message: 'Not authorised to edit this stall.' });
      }
    }

    const update = {};
    if (typeof req.body.name === 'string' && req.body.name.trim()) update.name = req.body.name.trim();
    if (typeof req.body.address === 'string' && req.body.address.trim()) update.address = req.body.address.trim();
    if (typeof req.body.phone === 'string' && req.body.phone.trim()) update.phone = req.body.phone.trim();
    if (typeof req.body.description === 'string') update.description = req.body.description;
    if (typeof req.body.latitude === 'number' && !Number.isNaN(req.body.latitude)) update.latitude = req.body.latitude;
    if (typeof req.body.longitude === 'number' && !Number.isNaN(req.body.longitude)) update.longitude = req.body.longitude;
    if (typeof req.body.profilePhoto === 'string' && req.body.profilePhoto.trim())
      update.profilePhoto = req.body.profilePhoto.trim();
    if (typeof req.body.coverPhoto === 'string' && req.body.coverPhoto.trim())
      update.coverPhoto = req.body.coverPhoto.trim();

    const hasHoursKeys =
      Object.prototype.hasOwnProperty.call(req.body, 'openingTime') ||
      Object.prototype.hasOwnProperty.call(req.body, 'closingTime');

    if (hasHoursKeys) {
      const rawO = req.body.openingTime;
      const rawC = req.body.closingTime;
      const oEmpty =
        rawO === undefined || rawO === null || (typeof rawO === 'string' && rawO.trim() === '');
      const cEmpty =
        rawC === undefined || rawC === null || (typeof rawC === 'string' && rawC.trim() === '');

      if (oEmpty && cEmpty) {
        update.openingTime = null;
        update.closingTime = null;
        update.hoursAuto = false;
      } else if (oEmpty !== cEmpty) {
        return res.status(400).json({
          message: 'Provide both opening and closing time (HH:mm), or leave both blank to remove scheduled hours.',
        });
      } else {
        const nO = normalizeTimeInput(rawO);
        const nC = normalizeTimeInput(rawC);
        if (nO === false || nC === false) {
          return res.status(400).json({
            message: 'Invalid time format. Use 24-hour HH:mm (for example 09:00 or 21:30).',
          });
        }
        if (!nO || !nC) {
          return res.status(400).json({
            message: 'Opening and closing time are required when setting business hours.',
          });
        }
        update.openingTime = nO;
        update.closingTime = nC;
        update.hoursAuto = true;
        const derived = deriveStatusFromHours(nO, nC);
        if (derived) update.status = derived;
      }
    }

    const clean = {};
    Object.keys(update).forEach((key) => {
      if (update[key] !== undefined) clean[key] = update[key];
    });

    if (Object.keys(clean).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    let stall = await Stall.findByIdAndUpdate(stallPre._id, { $set: clean }, { new: true, runValidators: true }).populate(
      'manager',
      'name email nic'
    );

    if (!stall) return res.status(404).json({ message: 'Stall not found' });

    stall = await persistAutoStatusForStall(Stall, stall);
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
    await User.deleteMany({ role: 'stall staff', staffStallId: req.params.id });
    await Stall.findByIdAndDelete(req.params.id);
    res.json({ message: 'Stall deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

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

const Ticket = require('./models/Ticket');

app.post('/api/tickets', async (req, res) => {
  const { stallId, title, description, screenshot } = req.body;
  if (!stallId || !title || !description || description.length < 10) {
    return res.status(400).json({ message: 'Title and description (min 10 chars) are required.' });
  }
  try {
    const auth = await authUserFromRequest(req);
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });

    const newTicket = new Ticket({
      stall: stallId,
      user: auth._id,
      title,
      description,
      screenshot: screenshot || '',
      staffHasSeenTicket: false,
      userHasSeenReply: true
    });
    await newTicket.save();
    res.status(201).json(newTicket);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/tickets/user/:stallId', async (req, res) => {
  try {
    const auth = await authUserFromRequest(req);
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });

    const tickets = await Ticket.find({ stall: req.params.stallId, user: auth._id }).sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/tickets/:id', async (req, res) => {
  try {
    const auth = await authUserFromRequest(req);
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    if (ticket.user.toString() !== auth._id.toString()) return res.status(403).json({ message: 'Not your ticket' });
    if (ticket.reply) return res.status(400).json({ message: 'Cannot update a ticket that has a reply' });

    const { title, description, screenshot } = req.body;
    let edited = false;
    if (title && title !== ticket.title) { ticket.title = title; edited = true; }
    if (description && description.length >= 10 && description !== ticket.description) { ticket.description = description; edited = true; }
    if (screenshot !== undefined && screenshot !== ticket.screenshot) { ticket.screenshot = screenshot; edited = true; }
    
    if (edited) {
      ticket.userEditedAt = new Date();
      ticket.staffHasSeenTicket = false;
    }

    await ticket.save();
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/tickets/:id', async (req, res) => {
  try {
    const auth = await authUserFromRequest(req);
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    if (ticket.user.toString() !== auth._id.toString()) return res.status(403).json({ message: 'Not your ticket' });
    if (ticket.reply) return res.status(400).json({ message: 'Cannot delete a ticket that has a reply' });

    await Ticket.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/tickets/stall/:stallId', async (req, res) => {
  try {
    const auth = await authUserFromRequest(req);
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });

    const tickets = await Ticket.find({ stall: req.params.stallId }).populate('user', 'name email').sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/tickets/:id/reply', async (req, res) => {
  try {
    const { reply } = req.body;
    const auth = await authUserFromRequest(req);
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    const isEditing = ticket.reply && ticket.reply !== reply;
    ticket.reply = reply;
    ticket.status = reply ? 'Solved' : 'Pending';
    
    if (!reply) {
      ticket.repliedAt = null;
      ticket.replyEditedAt = null;
      ticket.userHasSeenReply = true;
    } else if (isEditing) {
      ticket.replyEditedAt = new Date();
      ticket.userHasSeenReply = false;
    } else if (!ticket.repliedAt) {
      ticket.repliedAt = new Date();
      ticket.userHasSeenReply = false;
    }

    await ticket.save();
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark tickets as seen by user
app.put('/api/tickets/mark-seen/user/:stallId', async (req, res) => {
  try {
    const auth = await authUserFromRequest(req);
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });

    await Ticket.updateMany(
      { stall: req.params.stallId, user: auth._id, userHasSeenReply: false },
      { $set: { userHasSeenReply: true } }
    );
    res.json({ message: 'Marked as seen' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark tickets as seen by staff
app.put('/api/tickets/mark-seen/staff/:stallId', async (req, res) => {
  try {
    const auth = await authUserFromRequest(req);
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });

    await Ticket.updateMany(
      { stall: req.params.stallId, staffHasSeenTicket: false },
      { $set: { staffHasSeenTicket: true } }
    );
    res.json({ message: 'Marked as seen' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get unread counts
app.get('/api/tickets/unread-count/user/:stallId', async (req, res) => {
  try {
    const auth = await authUserFromRequest(req);
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });

    const count = await Ticket.countDocuments({ 
      stall: req.params.stallId, 
      user: auth._id, 
      userHasSeenReply: false 
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/tickets/unread-count/staff/:stallId', async (req, res) => {
  try {
    const auth = await authUserFromRequest(req);
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });

    const count = await Ticket.countDocuments({ 
      stall: req.params.stallId, 
      staffHasSeenTicket: false 
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Vercel serverless invokes this file as a module — do not bind a listener there.
module.exports = app;
if (!process.env.VERCEL && require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}
