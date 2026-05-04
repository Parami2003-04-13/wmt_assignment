// Database Model for Notifications
// Defines the schema (database table) for storing system notifications.
const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    // Database Connection/Relational mapping: Links this notification to a specific 'User'.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true, // Validation: Notification must belong to a user
      index: true,
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    type: { type: String, default: 'order_status', trim: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    orderIdDisplay: { type: String, trim: true },
    orderStatus: { type: String, trim: true },
    stallName: { type: String, trim: true },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

NotificationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);
