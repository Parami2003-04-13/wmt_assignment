const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [
    {
      meal: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Meal',
        required: true
      },
      name: String,
      quantity: {
        type: Number,
        required: true
      },
      price: {
        type: Number,
        required: true
      }
    }
  ],
  totalAmount: {
    type: Number,
    required: true
  },
  pickupTime: {
    type: Date,
    required: true
  },
  isStudentDiscount: {
    type: Boolean,
    default: false
  },
  studentIdImage: {
    type: String
  },
  paymentMethod: {
    type: String,
    enum: ['Pay at Stall', 'Card', 'Bank Transfer'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Failed'],
    default: 'Pending'
  },
  status: {
    type: String,
    enum: ['Pending', 'Preparing', 'Ready', 'Completed', 'Cancelled'],
    default: 'Pending'
  },
  orderId: {
    type: String,
    unique: true,
    required: true
  },
  orderPhoto: {
    type: String,
    default: ''
  },
  stall: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stall',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Order', OrderSchema);
