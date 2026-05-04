// Express Router for Order Management
// This file defines the API endpoints for order operations and routes incoming HTTP requests to the appropriate controller functions.
const express = require('express');
const orderController = require('../controllers/orderController');

const router = express.Router();

// Create Order Endpoint (POST request)
// Calls the createOrder controller logic to handle saving a new order to the database.
router.post('/', orderController.createOrder);

// Get orders by user
router.get('/user/:userId', orderController.getOrdersByUser);

// Get orders by stall (for owner/staff)
router.get('/stall/:stallId', orderController.getOrdersByStall);

// Update Order Endpoint (PATCH request)
// Used to modify existing orders (e.g., status changes, payment updates) in the database.
router.patch('/:id', orderController.updateOrder);

// Delete Order (Allowed for stall managers for past orders)
router.delete('/:id', orderController.deleteOrder);

module.exports = router;
