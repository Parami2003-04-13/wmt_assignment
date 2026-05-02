const express = require('express');
const router = express.Router();
const mealController = require('../controllers/mealController');

// Create Meal
router.post('/', mealController.createMeal);

// Get meals by Stall
router.get('/stall/:stallId', mealController.getMealsByStall);

// Get a single meal by ID
router.get('/:id', mealController.getMealById);

// Update Meal
router.patch('/:id', mealController.updateMeal);

// Delete Meal
router.delete('/:id', mealController.deleteMeal);

// Get all meals (for Explore/Discovery)
router.get('/', mealController.getAllMeals);

module.exports = router;
