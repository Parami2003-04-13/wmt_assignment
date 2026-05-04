// Database Model for Orders
// This defines the schema (similar to a database table) and validation rules for orders in MongoDB.
const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  // Database Connection/Relational mapping: Links this order to a specific 'User' document.
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true // Validation: An order must have a user attached.
  },
  items: [
    {
      // Relational mapping: Links each item to a 'Meal' document.
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
  // Validation: 'enum' restricts the value to only the strings specified in the array.
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
    enum: ['Pending', 'Processing', 'Preparing', 'Ready', 'Completed', 'Cancelled'],
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
  // Relational mapping: Links this order to a specific 'Stall' document.
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
