// Order Service Layer
// Handles complex business logic and database operations for creating an order.
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Meal = require('../models/Meal');

/**
 * Persist order + payment and decrement meal stock (single transaction-ish).
 * Caller is responsible for access control (e.g. stall staff approve vs direct checkout).
 */
async function placeOrderCommit({
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
}) {
  const orderCount = await Order.countDocuments();
  const uniqueId = `ORD-${Date.now().toString().slice(-4)}-${(orderCount + 1).toString().padStart(3, '0')}`;

  const newOrder = new Order({
    user: userId,
    stall: stallId,
    items,
    totalAmount,
    pickupTime,
    isStudentDiscount: !!isStudentDiscount,
    studentIdImage,
    paymentMethod,
    orderId: uniqueId,
    status: 'Pending',
    paymentStatus: orderPaymentStatus,
  });

  // Database Connection: Saves the newly created order to the MongoDB database.
  await newOrder.save();

  const newPayment = new Payment({
    order: newOrder._id,
    user: userId,
    amount: totalAmount,
    method: paymentMethod === 'Pay at Stall' ? 'Pay at Stall' : paymentMethod,
    status: paymentRecordStatus,
    paymentSlip: paymentSlip || '',
    cardHolderName: cardHolderName || '',
    cardLastFour: cardLastFour || '',
  });

  // Database Connection: Saves the associated payment record.
  await newPayment.save();

  // Logic/Database Update: Iterates through each ordered item and decrements the meal stock quantity.
  for (const item of items) {
    await Meal.findByIdAndUpdate(item.meal, {
      $inc: { quantity: -item.quantity },
    });
  }

  return { order: newOrder, payment: newPayment };
}

// Behavior: Determines the initial payment status and record status based on the selected payment method (e.g. Card vs Bank Transfer).
function defaultPaymentStatuses(paymentMethod) {
  if (paymentMethod === 'Card') {
    return { orderPaymentStatus: 'Paid', paymentRecordStatus: 'Paid' };
  }
  return { orderPaymentStatus: 'Pending', paymentRecordStatus: 'Pending' };
}

module.exports = {
  placeOrderCommit,
  defaultPaymentStatuses,
};
