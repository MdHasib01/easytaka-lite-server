const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const upload = require('../middleware/upload');

// Support image uploads (for task proofs, avatars, and National ID documents)
router.post('/', upload.single('image'), uploadController.uploadImage);

module.exports = router;
