const express = require('express');
const router = express.Router();
const supportTicketController = require('../controllers/supportTicketController');

// User routes
router.post('/', supportTicketController.createTicket);
router.get('/user/:stallId', supportTicketController.getUserTickets);
router.put('/:id', supportTicketController.updateTicket);
router.delete('/:id', supportTicketController.deleteTicket);
router.put('/mark-seen/user/:stallId', supportTicketController.markSeenByUser);
router.get('/unread-count/user/:stallId', supportTicketController.getUnreadCountByUser);

// Staff routes
router.get('/stall/:stallId', supportTicketController.getStallTickets);
router.put('/:id/reply', supportTicketController.replyToTicket);
router.put('/mark-seen/staff/:stallId', supportTicketController.markSeenByStaff);
router.get('/unread-count/staff/:stallId', supportTicketController.getUnreadCountByStaff);

module.exports = router;
