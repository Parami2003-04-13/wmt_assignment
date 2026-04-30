const mongoose = require('mongoose');

const StallSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String, required: true },
  phone: { type: String, required: true },
  description: { type: String },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  profilePhoto: { type: String },
  coverPhoto: { type: String },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approvedDocument: { type: String }, // URL or Path to the document
  isApproved: { type: Boolean, default: false },
  status: { type: String, enum: ['Open', 'Closed'], default: 'Open' },
  /** 24h "HH:mm" in Asia/Colombo (server); both set + hoursAuto → status derives from clock */
  openingTime: { type: String, default: null },
  closingTime: { type: String, default: null },
  hoursAuto: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Stall', StallSchema);
