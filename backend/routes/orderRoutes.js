const express = require('express');
const orderController = require('../controllers/orderController');

const router = express.Router();

// Create Order
router.post('/', orderController.createOrder);

// Get orders by user
router.get('/user/:userId', orderController.getOrdersByUser);

// Get orders by stall (for owner/staff)
router.get('/stall/:stallId', orderController.getOrdersByStall);

// Update Order (Status, Payment Status, Order Photo)
router.patch('/:id', orderController.updateOrder);

// Delete Order (Allowed for stall managers for past orders)
router.delete('/:id', orderController.deleteOrder);

module.exports = router;
