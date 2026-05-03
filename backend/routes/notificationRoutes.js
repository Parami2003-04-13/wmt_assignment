const express = require('express');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const list = await Notification.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json(list);
  } catch (err) {
    console.error('List notifications error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/unread-count', protect, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      user: req.user.id,
      read: false,
    });
    res.json({ count });
  } catch (err) {
    console.error('Unread count error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:id/read', protect, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid notification id' });
    }

    const n = await Notification.findOneAndUpdate(
      { _id: id, user: req.user.id },
      { $set: { read: true } },
      { new: true }
    ).lean();

    if (!n) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json(n);
  } catch (err) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/read-all', protect, async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user.id, read: false }, { $set: { read: true } });
    res.json({ ok: true });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
