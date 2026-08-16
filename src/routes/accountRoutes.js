const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.post('/', verifyToken, accountController.createAccount);
router.get('/my-accounts', verifyToken, accountController.getMyAccounts);
router.get('/milestone-progress', verifyToken, accountController.getMilestoneProgress);
router.get('/all', verifyToken, isAdmin, accountController.getAllAccounts);
router.put('/:id/verify', verifyToken, isAdmin, accountController.verifyAccount);
router.get('/:id', verifyToken, accountController.getAccountById);
router.put('/:id', verifyToken, accountController.updateAccount);
router.delete('/:id', verifyToken, accountController.deleteAccount);

module.exports = router;
