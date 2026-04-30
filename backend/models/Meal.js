const mongoose = require('mongoose');
//comment
const MealSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  image: { type: String }, // Optional
  stall: { type: mongoose.Schema.Types.ObjectId, ref: 'Stall', required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Meal', MealSchema);
