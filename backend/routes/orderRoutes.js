const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Meal = require('../models/Meal');
const Payment = require('../models/Payment');
const { authUserFromRequest } = require('../utils/authRequest');

const router = express.Router();

// Create Order
router.post('/', async (req, res) => {
  const { 
    userId, 
    stallId,
    items, 
    totalAmount, 
    pickupTime, 
    isStudentDiscount, 
    studentIdImage, 
    paymentMethod,
    paymentSlip, // Optional, for bank transfer
    cardHolderName, // Optional, for card
    cardLastFour // Optional, for card
  } = req.body;

  if (!userId || !stallId || !items || items.length === 0 || !totalAmount || !pickupTime || !paymentMethod) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const auth = await authUserFromRequest(req);
    if (auth && auth._id.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized to place order for another user.' });
    }

    // Generate Unique Order ID
    const orderCount = await Order.countDocuments();
    const uniqueId = `ORD-${Date.now().toString().slice(-4)}-${(orderCount + 1).toString().padStart(3, '0')}`;

    const newOrder = new Order({
      user: userId,
      stall: stallId,
      items,
      totalAmount,
      pickupTime,
      isStudentDiscount,
      studentIdImage,
      paymentMethod,
      orderId: uniqueId,
      status: 'Pending',
      paymentStatus: paymentMethod === 'Card' ? 'Paid' : 'Pending'
    });

    await newOrder.save();

    // Create Payment Record
    const newPayment = new Payment({
      order: newOrder._id,
      user: userId,
      amount: totalAmount,
      method: paymentMethod === 'Pay at Stall' ? 'Pay at Stall' : paymentMethod,
      status: paymentMethod === 'Card' ? 'Paid' : 'Pending',
      paymentSlip: paymentSlip || '',
      cardHolderName: cardHolderName || '',
      cardLastFour: cardLastFour || ''
    });

    await newPayment.save();

    // Update Stock
    for (const item of items) {
      await Meal.findByIdAndUpdate(item.meal, {
        $inc: { quantity: -item.quantity }
      });
    }

    res.status(201).json(newOrder);
  } catch (err) {
    console.error('Order creation error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get orders by user
router.get('/user/:userId', async (req, res) => {
  try {
    const auth = await authUserFromRequest(req);
    if (auth && auth._id.toString() !== req.params.userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const orders = await Order.find({ user: req.params.userId })
      .populate('stall', 'name')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get orders by stall (for owner/staff)
router.get('/stall/:stallId', async (req, res) => {
  try {
    const orders = await Order.find({ stall: req.params.stallId })
      .populate('user', 'name email')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Order (Status, Payment Status, Order Photo)
router.patch('/:id', async (req, res) => {
  const { status, paymentStatus, orderPhoto } = req.body;
  
  try {
    const existingOrder = await Order.findById(req.params.id);
    if (!existingOrder) return res.status(404).json({ message: 'Order not found' });

    const update = {};
    if (status) update.status = status;
    if (paymentStatus) {
      update.paymentStatus = paymentStatus;
      // If payment fails, automatically cancel the order
      if (paymentStatus === 'Failed') {
        update.status = 'Cancelled';
      }
    }
    if (orderPhoto !== undefined) update.orderPhoto = orderPhoto;

    // Stock restoration logic: if changing to 'Cancelled' and wasn't already 'Cancelled' or 'Completed'
    if (update.status === 'Cancelled' && existingOrder.status !== 'Cancelled' && existingOrder.status !== 'Completed') {
      for (const item of existingOrder.items) {
        await Meal.findByIdAndUpdate(item.meal, {
          $inc: { quantity: item.quantity }
        });
      }
    }

    const order = await Order.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
    
    if (paymentStatus) {
      await Payment.findOneAndUpdate({ order: req.params.id }, { $set: { status: paymentStatus } });
    }

    res.json(order);
  } catch (err) {
    console.error('Update order error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete Order (Allowed for stall managers for past orders)
router.delete('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Only refund stock if order was NOT completed/cancelled (optional logic, but let's keep it simple)
    if (order.status !== 'Completed' && order.status !== 'Cancelled') {
      for (const item of order.items) {
        await Meal.findByIdAndUpdate(item.meal, {
          $inc: { quantity: item.quantity }
        });
      }
    }

    await Order.findByIdAndDelete(req.params.id);
    await Payment.findOneAndDelete({ order: req.params.id });

    res.json({ message: 'Order and associated payment deleted' });
  } catch (err) {
    console.error('Delete order error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
