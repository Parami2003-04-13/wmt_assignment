const express = require('express');
const mongoose = require('mongoose');
const PendingBankTransfer = require('../models/PendingBankTransfer');
const Order = require('../models/Order');
const Meal = require('../models/Meal');
const Payment = require('../models/Payment');
const { authUserFromRequest } = require('../utils/authRequest');

const router = express.Router();

router.post('/', async (req, res) => {
  const { userId, stallId, items, totalAmount, pickupTime, paymentSlip, isStudentDiscount, studentIdImage } = req.body;

  if (!userId || !stallId || !items || items.length === 0 || totalAmount === undefined || !pickupTime) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const slip = String(paymentSlip ?? '').trim();
  if (!slip) {
    return res.status(400).json({ message: 'Please upload your bank transfer slip.' });
  }

  try {
    const auth = await authUserFromRequest(req);
    if (auth && auth._id.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized to submit transfer for another user.' });
    }

    const pending = await PendingBankTransfer.create({
      user: userId,
      stall: stallId,
      items,
      totalAmount,
      pickupTime,
      paymentSlip: slip,
      isStudentDiscount: !!isStudentDiscount,
      studentIdImage: studentIdImage || '',
      status: 'pending',
    });

    res.status(201).json(pending);
  } catch (err) {
    console.error('Pending bank transfer create error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/stall/:stallId', async (req, res) => {
  try {
    const stallId = req.params.stallId;
    if (!mongoose.Types.ObjectId.isValid(stallId)) {
      return res.json([]);
    }
    const list = await PendingBankTransfer.find({ stall: stallId, status: 'pending' })
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    res.json(list);
  } catch (err) {
    console.error('List pending bank transfers error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

async function approvePendingAndCreateOrder(pending) {
  const userId = pending.user;
  const stallId = pending.stall;
  const items = pending.items;
  const totalAmount = pending.totalAmount;
  const pickupTime = pending.pickupTime;
  const slip = pending.paymentSlip;

  const orderCount = await Order.countDocuments();
  const uniqueId = `ORD-${Date.now().toString().slice(-4)}-${(orderCount + 1).toString().padStart(3, '0')}`;

  const newOrder = new Order({
    user: userId,
    stall: stallId,
    items,
    totalAmount,
    pickupTime,
    isStudentDiscount: pending.isStudentDiscount,
    studentIdImage: pending.studentIdImage,
    paymentMethod: 'Bank Transfer',
    orderId: uniqueId,
    status: 'Pending',
    paymentStatus: 'Paid',
  });

  await newOrder.save();

  await Payment.create({
    order: newOrder._id,
    user: userId,
    amount: totalAmount,
    method: 'Bank Transfer',
    status: 'Paid',
    paymentSlip: slip,
    cardHolderName: '',
    cardLastFour: '',
  });

  for (const item of items) {
    await Meal.findByIdAndUpdate(item.meal, {
      $inc: { quantity: -item.quantity },
    });
  }

  return newOrder;
}

router.patch('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid id' });
    }

    const pending = await PendingBankTransfer.findById(id);
    if (!pending) {
      return res.status(404).json({ message: 'Pending transfer not found' });
    }
    if (pending.status !== 'pending') {
      return res.status(400).json({ message: 'This submission was already handled.' });
    }

    const newOrder = await approvePendingAndCreateOrder(pending);
    pending.status = 'approved';
    await pending.save();

    const populated = await Order.findById(newOrder._id)
      .populate('user', 'name email')
      .populate('items.meal', 'name image')
      .lean();

    res.json({ order: populated, pendingId: pending._id });
  } catch (err) {
    console.error('Approve pending bank transfer error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid id' });
    }

    const pending = await PendingBankTransfer.findById(id);
    if (!pending) {
      return res.status(404).json({ message: 'Pending transfer not found' });
    }
    if (pending.status !== 'pending') {
      return res.status(400).json({ message: 'This submission was already handled.' });
    }

    pending.status = 'rejected';
    await pending.save();
    res.json({ ok: true });
  } catch (err) {
    console.error('Reject pending bank transfer error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
