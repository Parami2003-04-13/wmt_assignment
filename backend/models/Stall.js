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
  status: { type: String, enum: ['Open', 'Closed'], default: 'Open' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Stall', StallSchema);
