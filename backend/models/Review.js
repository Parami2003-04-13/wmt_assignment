const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    meal: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Meal',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Links to the User model
        required: true
    },
    // The Star Rating (1 to 5)
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    // The text feedback
    comment: {
        type: String,
        required: true,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Prevent a user from reviewing the same meal multiple times
reviewSchema.index({ meal: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema, 'reviews');