const express = require('express');
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Order = require('../models/Order');

const router = express.Router();

const ARCHIVE_DELETE_RETENTION_YEARS = 10;

function paymentRecordOlderThanYears(createdAt, years) {
  if (!createdAt) return false;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - years);
  return new Date(createdAt) < cutoff;
}

// List payments for all orders belonging to a stall (owner/manage payments UI)
router.get('/stall/:stallId', async (req, res) => {
  try {
    const stallId = req.params.stallId;
    if (!mongoose.Types.ObjectId.isValid(stallId)) {
      return res.json([]);
    }
    const orderIds = await Order.find({ stall: stallId }).distinct('_id');
    if (!orderIds.length) {
      return res.json([]);
    }
    const payments = await Payment.find({ order: { $in: orderIds } })
      .populate('order', 'orderId totalAmount paymentMethod paymentStatus status pickupTime createdAt stall')
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    res.json(payments);
  } catch (err) {
    console.error('List stall payments error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get payment by order ID
router.get('/order/:orderId', async (req, res) => {
  try {
    const payment = await Payment.findOne({ order: req.params.orderId });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    res.json(payment);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update payment status (e.g. after manual verification of slip)
router.patch('/:id', async (req, res) => {
  const { status } = req.body;
  try {
    const payment = await Payment.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    
    // Sync status with Order
    await Order.findByIdAndUpdate(payment.order, { $set: { paymentStatus: status } });
    
    res.json(payment);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete archived payment records only (management UI retention policy).
router.delete('/:id', async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    const created = payment.createdAt || payment._id?.getTimestamp?.();
    if (!paymentRecordOlderThanYears(created, ARCHIVE_DELETE_RETENTION_YEARS)) {
      return res.status(400).json({
        message: `Payment records may only be deleted when older than ${ARCHIVE_DELETE_RETENTION_YEARS} years.`,
      });
    }

    // Delete associated order as well? Usually yes, if payment is gone, order is invalid.
    // The user said "payment management side can delete...", so I'll just delete the payment.
    // BUT usually it's better to delete both. I'll just delete the payment record as requested.
    await Payment.findByIdAndDelete(req.params.id);

    res.json({ message: 'Payment deleted successfully' });
  } catch (err) {
    console.error('Delete payment error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
