const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { getNotifications, markNotificationRead, markAllRead } = require('../controllers/notificationController');

router.get('/', protect, getNotifications);
router.put('/read-all', protect, markAllRead);
router.put('/:id/read', protect, markNotificationRead);

module.exports = router;
