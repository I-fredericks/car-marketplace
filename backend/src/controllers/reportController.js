const prisma = require('../config/db');
const { notifyAdmins } = require('./notificationController');

// @desc    Report a listing
// @route   POST /api/reports
// @access  Private
const createReport = async (req, res) => {
  try {
    const { vehicleId, reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ message: 'Reason is required' });
    }

    const report = await prisma.report.create({
      data: {
        reporterId: req.user.id,
        vehicleId: vehicleId ? parseInt(vehicleId) : null,
        reason: reason.trim()
      }
    });

    // Reports queue only moves when an admin reviews it — alert them now.
    notifyAdmins({
      type: 'ADMIN_NEW_REPORT',
      title: 'New report filed',
      body: reason.trim().slice(0, 120),
      senderId: req.user.id,
      vehicleId: vehicleId ? parseInt(vehicleId) : null,
      data: { path: '/admin?tab=reports', reportId: report.id },
    }).catch((e) => console.error('Admin report notify failed:', e.message));

    res.status(201).json({ message: 'Report submitted successfully', report });
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createReport };
