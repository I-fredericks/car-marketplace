const express = require('express');
const router = express.Router();
const { getConversations, getMessages, sendMessage, markConversationRead, deleteConversation, deleteMessage } = require('../controllers/messageController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/conversations', protect, getConversations);
router.get('/:userId/:vehicleId', protect, getMessages);
router.put('/:userId/:vehicleId/read', protect, markConversationRead);
router.delete('/:userId/:vehicleId', protect, deleteConversation);
router.delete('/message/:id', protect, deleteMessage);
router.post('/', protect, sendMessage);

module.exports = router;
