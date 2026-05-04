const Order = require('../models/Order');
const Meal = require('../models/Meal');
const Payment = require('../models/Payment');
const Stall = require('../models/Stall');
const Notification = require('../models/Notification');
const { authUserFromRequest } = require('../utils/authRequest');
const { placeOrderCommit, defaultPaymentStatuses } = require('../services/placeOrder');

// Helper Functions
function customerMessageForOrderStatus(orderIdDisplay, stallName, newStatus) {
  const ord = orderIdDisplay || 'Your order';
  const place = stallName ? `${stallName}` : 'the stall';

  switch (newStatus) {
    case 'Pending':
      return { title: 'Order placed', body: `${ord} at ${place} is pending confirmation.` };
    case 'Processing':
      return { title: 'Order update', body: `${place} is processing ${ord}.` };
    case 'Preparing':
      return { title: 'Being prepared', body: `${place} is preparing ${ord}.` };
    case 'Ready':
      return { title: 'Ready for pickup', body: `${ord} at ${place} is ready.` };
    case 'Completed':
      return { title: 'Order completed', body: `${ord} has been marked completed.` };
    case 'Cancelled':
      return { title: 'Order cancelled', body: `${ord} at ${place} was cancelled.` };
    default:
      return { title: 'Order update', body: `${ord} at ${place} is now ${newStatus}.` };
  }
}

function normalizePickupCode(raw) {
  if (raw === null || raw === undefined) return '';
  let s = String(raw).trim();
  if (!s) return '';
  try {
    const j = JSON.parse(s);
    if (j && typeof j.orderId === 'string') s = j.orderId;
  } catch (_) {
    /* keep s */
  }
  return s.replace(/\s+/g, '').toUpperCase();
}

function pickupCodeMatchesOrder(order, scannedRaw) {
  const expected = normalizePickupCode(order.orderId);
  if (!expected) return false;
  const n = normalizePickupCode(scannedRaw);
  if (!n) return false;
  if (n === expected) return true;
  if (n.includes(expected)) return true;
  return false;
}

// Create Order Logic
// Handles validation of user inputs, checks payment methods, and initiates the order creation process.
exports.createOrder = async (req, res) => {
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

  // Validation: Ensure all necessary fields are provided in the request body.
  if (!userId || !stallId || !items || items.length === 0 || !totalAmount || !pickupTime || !paymentMethod) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  if (paymentMethod === 'Bank Transfer') {
    return res.status(400).json({
      message:
        'Bank transfers are verified by staff before an order exists. Submit your slip from checkout — no order will be charged until verification.',
    });
  }

  try {
    const auth = await authUserFromRequest(req);
    if (auth && auth._id.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized to place order for another user.' });
    }

    const { orderPaymentStatus, paymentRecordStatus } = defaultPaymentStatuses(paymentMethod);

    // Service Layer Call / Database Connection: Commits the new order and associated payment to the database.
    const { order: newOrder } = await placeOrderCommit({
      userId,
      stallId,
      items,
      totalAmount,
      pickupTime,
      isStudentDiscount,
      studentIdImage,
      paymentMethod,
      paymentSlip,
      cardHolderName,
      cardLastFour,
      orderPaymentStatus,
      paymentRecordStatus,
    });

    res.status(201).json(newOrder);
  } catch (err) {
    console.error('Order creation error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get orders by user
// Database Fetching: Retrieves a list of orders specific to the currently logged-in user.
exports.getOrdersByUser = async (req, res) => {
  try {
    const auth = await authUserFromRequest(req);
    if (auth && auth._id.toString() !== req.params.userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Database Query: Finds orders by 'user' ID.
    // 'populate' is used to join data from the 'Stall' and 'Meal' collections to get readable names and images.
    const orders = await Order.find({ user: req.params.userId })
      .populate('stall', 'name')
      .populate('items.meal', 'name image')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get orders by stall (for owner/staff)
// Database Fetching: Retrieves a list of orders specific to a stall.
exports.getOrdersByStall = async (req, res) => {
  try {
    const orders = await Order.find({ stall: req.params.stallId })
      .populate('user', 'name email phone')
      .populate('items.meal', 'name image')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Update Order (Status, Payment Status, Order Photo)
// Logic: Handles complex state transitions (e.g., Pending -> Ready) and performs validations like requiring photos or pickup verification.
exports.updateOrder = async (req, res) => {
  const { status, paymentStatus, orderPhoto, pickupVerification } = req.body;
  
  try {
    // Database Fetching: Retrieve the existing order to validate state transitions.
    const existingOrder = await Order.findById(req.params.id);
    if (!existingOrder) return res.status(404).json({ message: 'Order not found' });

    if (status === 'Ready' && existingOrder.status !== 'Ready') {
      const photoToUse = orderPhoto !== undefined ? orderPhoto : existingOrder.orderPhoto;
      if (!photoToUse || !String(photoToUse).trim()) {
        return res.status(400).json({ message: 'Order confirmation photo is required before marking Ready.' });
      }
    }

    if (status === 'Completed' && existingOrder.status !== 'Completed') {
      if (existingOrder.status !== 'Ready') {
        return res.status(400).json({ message: 'Order must be Ready before marking Completed.' });
      }
      if (!pickupVerification || !pickupCodeMatchesOrder(existingOrder, pickupVerification)) {
        return res.status(400).json({
          message: 'Pickup verification failed. Scan the customer QR or enter the order number.',
        });
      }
    }

    const update = {};
    if (status) update.status = status;
    if (paymentStatus) {
      update.paymentStatus = paymentStatus;
      // If payment fails, automatically cancel the order
      if (paymentStatus === 'Failed') {
        update.status = 'Cancelled';
      }
    }
    // Pay at stall: completing with verified pickup QR / code counts as confirmation of payment at handover
    const payAtStallPickupVerifiedCompleting =
      status === 'Completed' &&
      existingOrder.status !== 'Completed' &&
      existingOrder.paymentMethod === 'Pay at Stall' &&
      existingOrder.paymentStatus !== 'Paid' &&
      pickupVerification &&
      pickupCodeMatchesOrder(existingOrder, pickupVerification) &&
      paymentStatus !== 'Failed';

    if (payAtStallPickupVerifiedCompleting) {
      update.paymentStatus = 'Paid';
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

    // Database Update: Save the updated fields back to the MongoDB 'Orders' table.
    await Order.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });

    if ('paymentStatus' in update && update.paymentStatus) {
      await Payment.findOneAndUpdate({ order: req.params.id }, { $set: { status: update.paymentStatus } });
    }

    let nextOrderStatus = existingOrder.status;
    if (typeof update.status === 'string') {
      nextOrderStatus = update.status;
    }

    const statusChanged = nextOrderStatus !== existingOrder.status;
    const paymentStatusChanged = !!(update.paymentStatus && update.paymentStatus !== existingOrder.paymentStatus);

    if ((statusChanged || paymentStatusChanged) && existingOrder.user) {
      try {
        const stallDoc = await Stall.findById(existingOrder.stall).select('name').lean();
        const stallName = stallDoc?.name || '';
        
        let title, body;
        if (statusChanged) {
          const msg = customerMessageForOrderStatus(existingOrder.orderId, stallName, nextOrderStatus);
          title = msg.title;
          body = msg.body;
        } else {
          // Only payment status changed (e.g. from Pending to Paid/Failed)
          title = 'Payment Update';
          body = `The payment status for order ${existingOrder.orderId} at ${stallName || 'the stall'} is now ${update.paymentStatus}.`;
        }

        await Notification.create({
          user: existingOrder.user,
          title,
          body,
          type: statusChanged ? 'order_status' : 'payment_status',
          order: existingOrder._id,
          orderIdDisplay: existingOrder.orderId,
          orderStatus: nextOrderStatus,
          stallName: stallName || undefined,
        });
      } catch (notifyErr) {
        console.error('Order status notification error:', notifyErr);
      }
    }

    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('items.meal', 'name image')
      .lean();

    res.json(order);
  } catch (err) {
    console.error('Update order error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete Order (Allowed for stall managers for past orders)
// Database Connection: Removes an order and its associated payment record from the database.
exports.deleteOrder = async (req, res) => {
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
};
