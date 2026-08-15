const express = require('express');
const router = express.Router();
const dailyController = require('../controllers/dailyController');
const { verifyToken } = require('../middleware/auth');

router.get('/today', verifyToken, dailyController.getTodayRoutines);
router.post('/update', verifyToken, dailyController.updateRoutineProgress);

module.exports = router;
