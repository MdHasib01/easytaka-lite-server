const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.get('/', verifyToken, settingsController.getSettings);
router.put('/', verifyToken, isAdmin, settingsController.updateSettings);

module.exports = router;
