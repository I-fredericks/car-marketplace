const prisma = require('../config/db');
const { pushToUser } = require('../services/eventBus');
const { createNotification } = require('./notificationController');

// @desc    Get conversations for current user
// @route   GET /api/messages/conversations
// @access  Private
const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    const latest = await prisma.$queryRaw`
      SELECT MAX(id) AS maxId FROM message WHERE senderId = ${userId} GROUP BY receiverId, vehicleId
      UNION
      SELECT MAX(id) AS maxId FROM message WHERE receiverId = ${userId} GROUP BY senderId, vehicleId
    `;
    const ids = latest.map((row) => Number(row.maxId)).filter(Number.isInteger);
    if (ids.length === 0) {
      return res.json([]);
    }

    const messages = await prisma.message.findMany({
      where: { id: { in: ids } },
      include: {
        receiver: {
          select: { id: true, name: true, email: true }
        },
        sender: {
          select: { id: true, name: true, email: true }
        },
        vehicle: {
          select: { id: true, make: true, model: true, year: true, status: true, images: { where: { isPrimary: true }, take: 1 } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const unreadCounts = await prisma.notification.groupBy({
      by: ['senderId', 'vehicleId'],
      where: {
        userId,
        type: 'NEW_MESSAGE',
        readAt: null,
      },
      _count: { id: true },
    });

    const spamCounts = await prisma.report.groupBy({
      by: ['vehicleId'],
      _count: { id: true },
    });

    const conversations = messages.map(msg => {
      const otherUser = msg.senderId === userId ? msg.receiver : msg.sender;
      const unreadCount = unreadCounts.find(
        u => u.senderId === otherUser.id && u.vehicleId === msg.vehicle.id
      )?._count.id || 0;

      const spamCount = spamCounts.find(s => s.vehicleId === msg.vehicle.id)?._count.id || 0;

      return {
        otherUser,
        vehicle: msg.vehicle,
        lastMessage: msg.content,
        lastMessageAt: msg.createdAt,
        unreadCount,
        spamCount,
      };
    });

    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get messages for a conversation
// @route   GET /api/messages/:userId/:vehicleId
// @access  Private
const getMessages = async (req, res) => {
  try {
    const { userId, vehicleId } = req.params;
    const currentUserId = req.user.id;

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: parseInt(userId) },
          { senderId: parseInt(userId), receiverId: currentUserId }
        ],
        vehicleId: parseInt(vehicleId)
      },
      include: {
        sender: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Send a message
// @route   POST /api/messages
// @access  Private
const sendMessage = async (req, res) => {
  try {
    const { receiverId, vehicleId, content } = req.body;

    if (!receiverId || !vehicleId || !content) {
      return res.status(400).json({ message: 'Receiver, vehicle, and content are required' });
    }

    const trimmed = String(content).trim();
    if (trimmed.length === 0 || trimmed.length > 2000) {
      return res.status(400).json({ message: 'Message must be between 1 and 2000 characters' });
    }

    const receiverIdNum = parseInt(receiverId, 10);
    const vehicleIdNum = parseInt(vehicleId, 10);
    if (!Number.isInteger(receiverIdNum) || !Number.isInteger(vehicleIdNum)) {
      return res.status(400).json({ message: 'Receiver and vehicle must be valid ids' });
    }

    const [receiver, vehicle] = await Promise.all([
      prisma.user.findUnique({ where: { id: receiverIdNum }, select: { id: true } }),
      prisma.vehicle.findUnique({
        where: { id: vehicleIdNum },
        select: { id: true, make: true, model: true, year: true },
      }),
    ]);
    if (!receiver || !vehicle) {
      return res.status(400).json({ message: 'Receiver or vehicle does not exist' });
    }

    const message = await prisma.message.create({
      data: {
        senderId: req.user.id,
        receiverId: receiverIdNum,
        vehicleId: vehicleIdNum,
        content: trimmed
      },
      include: {
        sender: {
          select: { id: true, name: true }
        }
      }
    });

    // Real-time delivery: push the message to the receiver's open SSE
    // streams (live chat append) and persist a notification (badge/toast).
    // Never blocks the response on failure — the row already exists.
    const vehicleTitle = `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim();
    try {
      pushToUser(receiverIdNum, 'message:new', {
        ...message,
        vehicleTitle,
      });
      await createNotification({
        userId: receiverIdNum,
        type: 'NEW_MESSAGE',
        title: `New message from ${req.user.name}`,
        body: trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed,
        senderId: req.user.id,
        vehicleId: vehicleIdNum,
        data: {
          senderId: req.user.id,
          senderName: req.user.name,
          vehicleId: vehicleIdNum,
          vehicleTitle,
          path: `/messages/${req.user.id}/${vehicleIdNum}`,
        },
      });
    } catch (notifyError) {
      console.error('Failed to notify receiver:', notifyError.message);
    }

    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Mark a conversation's NEW_MESSAGE notifications as read
// @route   PUT /api/messages/:userId/:vehicleId/read
// @access  Private
const markConversationRead = async (req, res) => {
  try {
    const otherUserId = parseInt(req.params.userId, 10);
    const vehicleId = parseInt(req.params.vehicleId, 10);
    if (!Number.isInteger(otherUserId) || !Number.isInteger(vehicleId)) {
      return res.status(400).json({ message: 'Invalid conversation ids' });
    }

    // senderId/vehicleId are indexed columns: single indexed UPDATE instead
    // of filtering JSON in JS (MySQL rejects Prisma JSON path filters)
    const updated = await prisma.notification.updateMany({
      where: {
        userId: req.user.id,
        type: 'NEW_MESSAGE',
        readAt: null,
        senderId: otherUserId,
        vehicleId,
      },
      data: { readAt: new Date() },
    });

    if (updated.count > 0) {
      // Sync the badge on the user's other sessions/devices right away.
      pushToUser(req.user.id, 'notification:read', { senderId: otherUserId, vehicleId, count: updated.count });
    }

    res.json({ message: 'Conversation marked as read', updated: updated.count });
  } catch (error) {
    console.error('Error marking conversation read:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete an entire conversation between current user and another user for a vehicle
// @route   DELETE /api/messages/:userId/:vehicleId
// @access  Private
const deleteConversation = async (req, res) => {
  try {
    const otherUserId = parseInt(req.params.userId, 10);
    const vehicleId = parseInt(req.params.vehicleId, 10);
    if (!Number.isInteger(otherUserId) || !Number.isInteger(vehicleId)) {
      return res.status(400).json({ message: 'Invalid conversation ids' });
    }

    const result = await prisma.message.deleteMany({
      where: {
        OR: [
          { senderId: req.user.id, receiverId: otherUserId, vehicleId },
          { senderId: otherUserId, receiverId: req.user.id, vehicleId },
        ],
      },
    });

    res.json({ message: 'Conversation deleted', deletedCount: result.count });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete a single message
// @route   DELETE /api/messages/message/:id
// @access  Private
const deleteMessage = async (req, res) => {
  try {
    const messageId = parseInt(req.params.id, 10);
    if (!Number.isInteger(messageId)) {
      return res.status(400).json({ message: 'Invalid message id' });
    }

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, senderId: true, receiverId: true },
    });
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    if (message.senderId !== req.user.id && message.receiverId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this message' });
    }

    await prisma.message.delete({
      where: { id: messageId },
    });

    res.json({ message: 'Message deleted' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getConversations,
  getMessages,
  sendMessage,
  markConversationRead,
  deleteConversation,
  deleteMessage,
};
