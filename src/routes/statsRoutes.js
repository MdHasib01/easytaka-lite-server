const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const { verifyToken } = require('../middleware/auth');

router.get('/dashboard', verifyToken, statsController.getDashboardStats);
router.get('/leaderboard', verifyToken, statsController.getLeaderboard);
router.get('/transactions', verifyToken, statsController.getPointHistory);

module.exports = router;
