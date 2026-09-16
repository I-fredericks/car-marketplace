const express = require('express');
const router = express.Router();
const { getConversations, getMessages, sendMessage, markConversationRead, deleteConversation, deleteMessage } = require('../controllers/messageController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/conversations', protect, getConversations);
// Single-message delete must be registered before /:userId/:vehicleId, or
// Express matches 'message' as a userId and the route 400s forever.
router.delete('/message/:id', protect, deleteMessage);
router.get('/:userId/:vehicleId', protect, getMessages);
router.put('/:userId/:vehicleId/read', protect, markConversationRead);
router.delete('/:userId/:vehicleId', protect, deleteConversation);
router.post('/', protect, sendMessage);

module.exports = router;
