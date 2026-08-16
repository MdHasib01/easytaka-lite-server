const express = require('express');
const router = express.Router();
const dailyTaskManagerController = require('../controllers/dailyTaskManagerController');
const { verifyToken, isAdmin } = require('../middleware/auth');

// All routes require Admin privileges
router.use(verifyToken, isAdmin);

router.get('/stats', dailyTaskManagerController.getDailyTaskStats);
router.get('/preview-load-balancer', dailyTaskManagerController.previewLoadBalancer);
router.get('/', dailyTaskManagerController.listDailyTasks);
router.post('/', dailyTaskManagerController.createDailyTask);
router.put('/:id', dailyTaskManagerController.updateDailyTask);
router.delete('/:id', dailyTaskManagerController.deleteDailyTask);

module.exports = router;
