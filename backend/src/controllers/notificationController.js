const prisma = require('../config/db');
const { pushToUser } = require('../services/eventBus');

const NOTIFICATION_TYPES = ['NEW_MESSAGE', 'LISTING_SAVED', 'LISTING_APPROVED', 'LISTING_REJECTED', 'LISTING_SOLD', 'SYSTEM'];

/**
 * Create a notification row and push it over the user's SSE stream.
 * Returns the created notification (data carries routing info for clients).
 * senderId/vehicleId are stored as columns for NEW_MESSAGE so a single
 * conversation's badge can be cleared with read-all?senderId=&vehicleId=.
 */
async function createNotification({ userId, type, title, body = null, data = null, senderId = null, vehicleId = null }) {
  const notification = await prisma.notification.create({
    data: { userId, type, title, body, data, senderId, vehicleId },
  });
  pushToUser(userId, 'notification:new', notification);
  return notification;
}

// @desc    List recent notifications + unread count
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.notification.count({
        where: { userId: req.user.id, readAt: null },
      }),
    ]);
    res.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Mark one notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markNotificationRead = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updated = await prisma.notification.updateMany({
      where: { id, userId: req.user.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ message: 'Notification marked as read', updated: updated.count });
  } catch (error) {
    console.error('Error marking notification:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Mark notifications as read (optionally scoped to one type and/or
//          one chat via senderId + vehicleId)
// @route   PUT /api/notifications/read-all?type=NEW_MESSAGE&senderId=1&vehicleId=2
// @access  Private
const markAllRead = async (req, res) => {
  try {
    const parse = (v) => (v !== undefined && v !== '' ? parseInt(v, 10) : null);
    const senderId = parse(req.query.senderId);
    const vehicleId = parse(req.query.vehicleId);
    const updated = await prisma.notification.updateMany({
      where: {
        userId: req.user.id,
        readAt: null,
        ...(req.query.type ? { type: req.query.type } : {}),
        ...(senderId ? { senderId } : {}),
        ...(vehicleId ? { vehicleId } : {}),
      },
      data: { readAt: new Date() },
    });
    res.json({ message: 'Notifications marked as read', updated: updated.count });
  } catch (error) {
    console.error('Error marking notifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createNotification,
  getNotifications,
  markNotificationRead,
  markAllRead,
  NOTIFICATION_TYPES,
};
