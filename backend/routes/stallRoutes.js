const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Stall = require('../models/Stall');
const Meal = require('../models/Meal');
const {
  normalizeTimeInput,
  deriveStatusFromHours,
  persistAutoStatusForStall,
} = require('../utils/businessHours');
const {
  sendNotificationEmail,
  getApproveEmailTemplate,
  getRejectEmailTemplate,
  getReviewEmailTemplate,
  getAdminNotificationTemplate,
} = require('../utils/emailService');
const { authUserFromRequest, isStallOwnerUser } = require('../utils/authRequest');

const router = express.Router();

const sendEmailInBackground = (to, subject, htmlContent) => {
  sendNotificationEmail(to, subject, htmlContent).catch((error) => {
    console.error('Background email error:', error);
  });
};

// Create Stall
router.post('/', async (req, res) => {
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

    (async () => {
      try {
        const owner = await User.findById(managerId);
        if (owner && owner.email) {
          const ownerMsg = getReviewEmailTemplate(owner.name, name);
          sendEmailInBackground(owner.email, `Stall Under Review: ${name}`, ownerMsg);

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
router.get('/manager/:managerId', async (req, res) => {
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

// --- Stall staff ---
router.post('/:stallId/staff', async (req, res) => {
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

router.get('/:stallId/staff', async (req, res) => {
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

router.delete('/:stallId/staff/:userId', async (req, res) => {
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

// Update Stall Status
router.patch('/:id/status', async (req, res) => {
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
router.patch('/:id/approve', async (req, res) => {
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

// Update stall details
router.patch('/:id', async (req, res) => {
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
        // Staff can only update non-restricted fields (like bank details)
        const restrictedFields = [
          'name',
          'address',
          'phone',
          'description',
          'latitude',
          'longitude',
          'profilePhoto',
          'coverPhoto',
          'openingTime',
          'closingTime',
        ];

        const isAttemptingRestricted = Object.keys(req.body).some((key) =>
          restrictedFields.includes(key)
        );

        if (isAttemptingRestricted) {
          return res.status(403).json({
            message: 'Staff cannot change description, hours, phone, stall images, or address.',
          });
        }

        // Verify staff belongs to this stall
        if (!auth.staffStallId || auth.staffStallId.toString() !== id) {
          return res.status(403).json({ message: 'Not authorised to edit this stall.' });
        }
      }
      const platformOk = auth.role === 'stall manager' || auth.role === 'admin';
      const ownerOk = auth.role === 'stall owner' && isStallOwnerUser(stallPre, auth);
      if (!(platformOk || ownerOk || auth.role === 'stall staff')) {
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
    if (typeof req.body.bankName === 'string') update.bankName = req.body.bankName;
    if (typeof req.body.accountNumber === 'string') update.accountNumber = req.body.accountNumber;
    if (typeof req.body.accountName === 'string') update.accountName = req.body.accountName;
    if (typeof req.body.branchName === 'string') update.branchName = req.body.branchName;

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
router.delete('/:id', async (req, res) => {
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

// Get All Stalls (for Admin) — before GET /:id so /api/stalls is not treated as an id
router.get('/', async (req, res) => {
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

// Get Stall by ID
router.get('/:id', async (req, res) => {
  try {
    let stall = await Stall.findById(req.params.id);
    if (!stall) return res.status(404).json({ message: 'Stall not found' });
    stall = await persistAutoStatusForStall(Stall, stall);
    res.json(stall);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
