const prisma = require('../config/db');

// @desc    Get conversations for current user
// @route   GET /api/messages/conversations
// @access  Private
const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    const sent = await prisma.message.findMany({
      where: { senderId: userId },
      include: {
        receiver: {
          select: { id: true, name: true, email: true }
        },
        vehicle: {
          select: { id: true, make: true, model: true, year: true, images: { where: { isPrimary: true }, take: 1 } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const received = await prisma.message.findMany({
      where: { receiverId: userId },
      include: {
        sender: {
          select: { id: true, name: true, email: true }
        },
        vehicle: {
          select: { id: true, make: true, model: true, year: true, images: { where: { isPrimary: true }, take: 1 } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const conversations = new Map();

    [...sent, ...received].forEach(msg => {
      const otherUser = msg.senderId === userId ? msg.receiver : msg.sender;
      const key = `${otherUser.id}-${msg.vehicleId}`;
      if (!conversations.has(key)) {
        conversations.set(key, {
          otherUser,
          vehicle: msg.vehicle,
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt
        });
      }
    });

    res.json(Array.from(conversations.values()));
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

    const message = await prisma.message.create({
      data: {
        senderId: req.user.id,
        receiverId: parseInt(receiverId),
        vehicleId: parseInt(vehicleId),
        content
      },
      include: {
        sender: {
          select: { id: true, name: true }
        }
      }
    });

    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getConversations,
  getMessages,
  sendMessage
};
