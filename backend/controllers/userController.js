const mongoose = require('mongoose');
const User = require('../models/User');
const Stall = require('../models/Stall');
const Meal = require('../models/Meal');

/** Update profile (minimal; aligns with Expo-stored user after login) */
exports.updateUser = async (req, res) => {
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
};

exports.deleteUser = async (req, res) => {
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
};
