const express = require('express');
const router = express.Router();
const { getConversations, getMessages, sendMessage } = require('../controllers/messageController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/conversations', protect, getConversations);
router.get('/:userId/:vehicleId', protect, getMessages);
router.post('/', protect, sendMessage);

module.exports = router;
