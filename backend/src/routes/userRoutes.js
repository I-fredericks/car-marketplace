const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { avatarUpload, uploadAvatar } = require('../controllers/avatarController');

router.post('/avatar', protect, avatarUpload, uploadAvatar);

module.exports = router;
