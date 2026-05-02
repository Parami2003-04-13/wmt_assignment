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

  await newPayment.save();

  for (const item of items) {
    await Meal.findByIdAndUpdate(item.meal, {
      $inc: { quantity: -item.quantity },
    });
  }

  return { order: newOrder, payment: newPayment };
}

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
