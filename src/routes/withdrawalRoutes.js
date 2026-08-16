const express = require('express');
const router = express.Router();
const withdrawalController = require('../controllers/withdrawalController');
const { verifyToken, isAdmin, isSMM } = require('../middleware/auth');

// SMM: Get 7-Day Cycle & Redemption Eligibility
router.get('/eligibility', verifyToken, withdrawalController.getEligibility);

// SMM: Create Withdrawal Request (bKash)
router.post('/', verifyToken, isSMM, withdrawalController.createWithdrawal);

// SMM: Get Own Withdrawals
router.get('/my', verifyToken, isSMM, withdrawalController.getMyWithdrawals);

// Stats (Admin or SMM)
router.get('/stats', verifyToken, withdrawalController.getWithdrawalStats);

// Admin: Get All Withdrawals (Filter & Search)
router.get('/', verifyToken, isAdmin, withdrawalController.getAllWithdrawals);

// Admin: Update Status (Approve/Pay with TrxID or Reject with refund)
router.patch('/:id/status', verifyToken, isAdmin, withdrawalController.updateWithdrawalStatus);

module.exports = router;
