const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { verifyToken, isAdmin, isSMM } = require('../middleware/auth');

// Task CRUD
router.post('/', verifyToken, isAdmin, taskController.createTask);
router.get('/', verifyToken, taskController.getTasks);
router.get('/submissions/all', verifyToken, isAdmin, taskController.getAllSubmissions);
router.get('/submissions/my', verifyToken, isSMM, taskController.getMySubmissions);
router.put('/submissions/:id/verify', verifyToken, isAdmin, taskController.verifySubmission);

router.get('/:id', verifyToken, taskController.getTaskById);
router.put('/:id', verifyToken, isAdmin, taskController.updateTask);
router.delete('/:id', verifyToken, isAdmin, taskController.deleteTask);
router.post('/:taskId/submit', verifyToken, isSMM, taskController.submitTaskProof);

module.exports = router;
