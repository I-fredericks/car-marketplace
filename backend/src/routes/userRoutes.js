const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { avatarUpload, uploadAvatar, saveDeviceToken } = require('../controllers/avatarController');

router.post('/avatar', protect, avatarUpload, uploadAvatar);

// FCM registration token for push delivery when the app is backgrounded.
router.put('/device-token', protect, saveDeviceToken);

module.exports = router;
