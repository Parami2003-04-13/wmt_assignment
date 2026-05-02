const express = require('express');
const stallController = require('../controllers/stallController');

const router = express.Router();

router.post('/', stallController.createStall);
router.get('/manager/:managerId', stallController.getStallsByManager);

router.post('/:stallId/staff', stallController.addStallStaff);
router.get('/:stallId/staff', stallController.listStallStaff);
router.delete('/:stallId/staff/:userId', stallController.removeStallStaff);

router.patch('/:id/status', stallController.updateStallStatus);
router.patch('/:id/approve', stallController.approveStall);
router.patch('/:id', stallController.updateStall);
router.delete('/:id', stallController.deleteStall);

router.get('/', stallController.getAllStalls);
router.get('/:id', stallController.getStallById);

module.exports = router;
