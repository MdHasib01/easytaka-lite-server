const express = require('express');
const router = express.Router();
const dailyController = require('../controllers/dailyController');
const { verifyToken, isAdmin } = require('../middleware/auth');

// SMM endpoints
router.get('/today', verifyToken, dailyController.getTodayRoutines);
router.post('/update', verifyToken, dailyController.updateRoutineProgress);
router.post('/submit', verifyToken, dailyController.submitDailyWork);

// Admin review & midnight cron trigger endpoints
router.get('/submissions', verifyToken, isAdmin, dailyController.listDailySubmissions);
router.post('/submissions/:id/review', verifyToken, isAdmin, dailyController.reviewDailySubmission);
router.post('/trigger-midnight-rewards', verifyToken, isAdmin, dailyController.triggerMidnightDailyRewards);

module.exports = router;
