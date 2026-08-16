const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Public Onboarding & Auth Routes
router.post('/login', authController.login);
router.get('/invitation/:token', authController.verifyInvitationToken);
router.post('/complete-onboarding', authController.completeSmmOnboarding);

// Protected User Routes
router.get('/me', verifyToken, authController.getMe);
router.put('/profile', verifyToken, authController.updateProfile);

// Admin-Only SMM Management & Verification Routes
router.post('/invite-smm', verifyToken, isAdmin, authController.inviteSMM);
router.get('/smm-verifications', verifyToken, isAdmin, authController.listSmmVerifications);
router.post('/verify-smm/:id', verifyToken, isAdmin, authController.verifySmm);
router.post('/resend-invite/:id', verifyToken, isAdmin, authController.resendInvitation);
router.get('/smms', verifyToken, isAdmin, authController.listSMMs);
router.put('/smms/:id/daily-reward', verifyToken, isAdmin, authController.updateSmmDailyReward);

module.exports = router;
