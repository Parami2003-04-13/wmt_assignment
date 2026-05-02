const mongoose = require('mongoose');

const PendingBankTransferSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    stall: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Stall',
      required: true,
      index: true,
    },
    items: [
      {
        meal: { type: mongoose.Schema.Types.ObjectId, ref: 'Meal', required: true },
        name: String,
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
      },
    ],
    totalAmount: { type: Number, required: true },
    pickupTime: { type: Date, required: true },
    paymentSlip: { type: String, required: true, trim: true },
    isStudentDiscount: { type: Boolean, default: false },
    studentIdImage: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true }
);

PendingBankTransferSchema.index({ stall: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('PendingBankTransfer', PendingBankTransferSchema);
