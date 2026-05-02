const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Review = require('../models/Review'); // Path to your Review model
const { protect } = require('../middleware/authMiddleware'); // Your auth protector

// @desc    Create a new review
// @route   POST /api/reviews
// @access  Private (Logged-in users only)
router.post('/', protect, async (req, res) => {
    try {
        const { meal, rating, comment, image } = req.body;

        // 1. Check if the user already reviewed this meal
        const alreadyReviewed = await Review.findOne({
            user: req.user.id,
            meal: meal
        });

        if (alreadyReviewed) {
            return res.status(400).json({ message: 'You have already reviewed this meal' });
        }

        // 2. Create the review object
        const newReview = new Review({
            user: req.user.id,    // Provided by 'protect' middleware
            meal: meal,           // The ID of the food
            rating: Number(rating),
            comment: comment,
            image: image ? String(image).trim() : null
        });

        // 3. Save to MongoDB
        const savedReview = await newReview.save();

        res.status(201).json(savedReview);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

// @desc    Get average rating and review count for a meal
// @route   GET /api/reviews/stats/:mealId
// @access  Public
router.get('/stats/:mealId', async (req, res) => {
    try {
        const stats = await Review.aggregate([
            { $match: { meal: new mongoose.Types.ObjectId(req.params.mealId) } },
            {
                $group: {
                    _id: '$meal',
                    averageRating: { $avg: '$rating' },
                    reviewCount: { $sum: 1 }
                }
            }
        ]);

        if (stats.length === 0) {
            return res.json({ averageRating: 0, reviewCount: 0 });
        }

        res.json({
            averageRating: Math.round(stats[0].averageRating * 10) / 10,
            reviewCount: stats[0].reviewCount
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});
// @desc    Get all reviews for a specific meal
// @route   GET /api/reviews/meal/:mealId
// @access  Public (Anyone can see reviews)
router.get('/meal/:mealId', async (req, res) => {
    try {
        // Find reviews matching the meal ID
        // .populate('user', 'name') helps us get the user's name from the User model
        const reviews = await Review.find({ meal: req.params.mealId })
                                    .populate('user', 'name')
                                    .sort({ createdAt: -1 }); // Show newest first

        if (!reviews) {
            return res.status(404).json({ message: 'No reviews found for this meal' });
        }

        res.json(reviews);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});
// @desc    Update a review
// @route   PUT /api/reviews/:id
// @access  Private (Owner only)
router.put('/:id', protect, async (req, res) => {
    try {
        const { rating, comment, image } = req.body;

        // 1. Find the review
        const review = await Review.findById(req.params.id);

        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }

        // 2. Check if the logged-in user is the owner of the review
        if (review.user.toString() !== req.user.id) {
            return res.status(401).json({ message: 'User not authorized to update this review' });
        }

        // 3. Update the fields and the updatedAt timestamp
        review.rating = rating || review.rating;
        review.comment = comment || review.comment;
        if (image !== undefined) {
            review.image = image ? String(image).trim() : null;
        }
        review.updatedAt = Date.now(); // Manual update of your new field

        const updatedReview = await review.save();
        res.json(updatedReview);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});
// @desc    Delete a review
// @route   DELETE /api/reviews/:id
// @access  Private (Owner only)
router.delete('/:id', protect, async (req, res) => {
    try {
        console.log(`Delete request for review ${req.params.id} by user ${req.user.id}`);
        const review = await Review.findById(req.params.id);

        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }

        // Check ownership
        if (String(review.user) !== String(req.user.id)) {
            console.log(`Auth mismatch: Review owner ${review.user} vs Acting user ${req.user.id}`);
            return res.status(401).json({ message: 'User not authorized' });
        }

        await review.deleteOne();
        res.json({ message: 'Review removed successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

module.exports = router;