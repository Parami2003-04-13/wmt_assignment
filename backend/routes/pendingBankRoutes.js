const express = require('express');
const mongoose = require('mongoose');
const PendingBankTransfer = require('../models/PendingBankTransfer');
const Notification = require('../models/Notification');
const Stall = require('../models/Stall');
const { authUserFromRequest, stallCanManageMeals } = require('../utils/authRequest');
const { placeOrderCommit } = require('../services/placeOrder');

const router = express.Router();

/** Customer submits bank slip — no Order until staff approves */
router.post('/', async (req, res) => {
  try {
    const {
      userId,
      stallId,
      items,
      totalAmount,
      pickupTime,
      isStudentDiscount,
      studentIdImage,
      paymentSlip,
    } = req.body;

    if (!paymentSlip || !String(paymentSlip).trim()) {
      return res.status(400).json({ message: 'Bank transfer slip is required.' });
    }
    if (!userId || !stallId || !items || items.length === 0 || totalAmount === undefined || !pickupTime) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const auth = await authUserFromRequest(req);
    if (!auth || auth._id.toString() !== String(userId)) {
      return res.status(403).json({ message: 'Unauthorized.' });
    }

    const pending = await PendingBankTransfer.create({
      user: userId,
      stall: stallId,
      items,
      totalAmount,
      pickupTime,
      isStudentDiscount: !!isStudentDiscount,
      studentIdImage: studentIdImage || '',
      paymentSlip: String(paymentSlip).trim(),
      status: 'PendingReview',
    });

    // Create notification for user
    try {
      const stallDoc = await Stall.findById(stallId).select('name').lean();
      await Notification.create({
        user: userId,
        title: 'Payment submitted',
        body: `Your bank transfer slip for Rs. ${totalAmount} at ${stallDoc?.name || 'the stall'} has been submitted and is pending verification.`,
        type: 'bank_transfer_pending',
      });
    } catch (notifyErr) {
      console.error('Pending bank notification error:', notifyErr);
    }

    res.status(201).json({
      message:
        'Your transfer is pending review. You will receive a notification when staff verify it and confirm your order.',
      id: pending._id,
    });
  } catch (err) {
    console.error('Submit pending bank transfer error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/stall/:stallId', async (req, res) => {
  try {
    const stallId = req.params.stallId;
    if (!mongoose.Types.ObjectId.isValid(stallId)) {
      return res.json([]);
    }

    const auth = await authUserFromRequest(req);
    if (!auth) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const { ok } = await stallCanManageMeals(
      stallId,
      auth._id.toString(),
      auth.role,
      auth.staffStallId ? String(auth.staffStallId) : null
    );
    if (!ok) {
      return res.status(403).json({ message: 'Cannot view pending transfers for this stall.' });
    }

    const list = await PendingBankTransfer.find({
      stall: stallId,
      status: 'PendingReview',
    })
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(80)
      .lean();

    res.json(list);
  } catch (err) {
    console.error('List pending bank transfers error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:id/approve', async (req, res) => {
  try {
    const pending = await PendingBankTransfer.findById(req.params.id);
    if (!pending) return res.status(404).json({ message: 'Request not found' });
    if (pending.status !== 'PendingReview') {
      return res.status(400).json({ message: 'This request has already been processed.' });
    }

    const auth = await authUserFromRequest(req);
    if (!auth) return res.status(401).json({ message: 'Not authorized' });

    const stallId = pending.stall.toString();
    const { ok } = await stallCanManageMeals(
      stallId,
      auth._id.toString(),
      auth.role,
      auth.staffStallId ? String(auth.staffStallId) : null
    );
    if (!ok) return res.status(403).json({ message: 'Cannot approve for this stall.' });

    const { order } = await placeOrderCommit({
      userId: pending.user.toString(),
      stallId,
      items: pending.items,
      totalAmount: pending.totalAmount,
      pickupTime: pending.pickupTime,
      isStudentDiscount: pending.isStudentDiscount,
      studentIdImage: pending.studentIdImage,
      paymentMethod: 'Bank Transfer',
      paymentSlip: pending.paymentSlip,
      cardHolderName: '',
      cardLastFour: '',
      orderPaymentStatus: 'Paid',
      paymentRecordStatus: 'Paid',
    });

    pending.status = 'Approved';
    await pending.save();

    try {
      const stallDoc = await Stall.findById(stallId).select('name').lean();
      const stallName = stallDoc?.name || '';
      await Notification.create({
        user: pending.user,
        title: 'Order confirmed',
        body: stallName
          ? `${stallName} verified your bank transfer. Order ${order.orderId} is placed — check My Orders for status.`
          : `Your bank transfer was verified. Order ${order.orderId} is placed — check My Orders for status.`,
        type: 'bank_transfer_approved',
        order: order._id,
        orderIdDisplay: order.orderId,
        orderStatus: order.status,
        stallName: stallName || undefined,
      });
    } catch (notifyErr) {
      console.error('Approve bank notify error:', notifyErr);
    }

    res.json({
      ok: true,
      orderId: order.orderId,
      orderMongoId: order._id.toString(),
    });
  } catch (err) {
    console.error('Approve pending bank error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:id/reject', async (req, res) => {
  try {
    const pending = await PendingBankTransfer.findById(req.params.id);
    if (!pending) return res.status(404).json({ message: 'Request not found' });
    if (pending.status !== 'PendingReview') {
      return res.status(400).json({ message: 'This request has already been processed.' });
    }

    const auth = await authUserFromRequest(req);
    if (!auth) return res.status(401).json({ message: 'Not authorized' });

    const stallId = pending.stall.toString();
    const { ok } = await stallCanManageMeals(
      stallId,
      auth._id.toString(),
      auth.role,
      auth.staffStallId ? String(auth.staffStallId) : null
    );
    if (!ok) return res.status(403).json({ message: 'Cannot reject for this stall.' });

    const note = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 400) : '';
    pending.status = 'Rejected';
    pending.rejectReason = note || pending.rejectReason;
    await pending.save();

    try {
      const stallDoc = await Stall.findById(stallId).select('name').lean();
      await Notification.create({
        user: pending.user,
        title: 'Bank transfer not approved',
        body: stallDoc?.name
          ? `${stallDoc.name} could not verify your transfer. Rs. ${pending.totalAmount} — submit again or choose another payment.`
          : `We could not verify your transfer. Submit again from checkout if needed.`,
        type: 'bank_transfer_rejected',
        read: false,
      });
    } catch (notifyErr) {
      console.error('Reject bank notify error:', notifyErr);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Reject pending bank error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
