const express = require('express');
const Payment = require('../models/Payment');
const Order = require('../models/Order');

const router = express.Router();

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

// Delete Payment (Specific conditions: Bank Transfer or Failed Card)
router.delete('/:id', async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    // Condition check
    const isBankTransfer = payment.method === 'Bank Transfer';
    const isFailedCard = payment.method === 'Card' && payment.status === 'Failed';

    if (!isBankTransfer && !isFailedCard) {
      return res.status(400).json({ message: 'Only Bank Transfer or Failed Card payments can be deleted.' });
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
