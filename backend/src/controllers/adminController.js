const prisma = require('../config/db');
const { applyVerifiedPayment } = require('./billingController');
const { commissionFor } = require('../config/plans');
const cache = require('../services/cache');
const audit = require('../services/audit');

// Identity of the acting admin, spread into every audit logAction call.
const actorFrom = (req) => ({
  actorId: req.user.id,
  actorRole: req.user.role,
  actorName: req.user.name,
});

const VEHICLE_STATUSES = ['PENDING', 'AVAILABLE', 'REJECTED', 'SOLD', 'DEACTIVATED', 'REMOVED'];

// Seller-facing copy for each moderation outcome.
const LISTING_STATUS_NOTIFICATIONS = {
  AVAILABLE: { type: 'LISTING_APPROVED', title: 'Your listing was approved' },
  REJECTED: { type: 'LISTING_REJECTED', title: 'Your listing was rejected' },
  DEACTIVATED: {
    type: 'LISTING_REMOVED',
    title: 'Your listing was taken down',
    body: 'Your listing is no longer visible to buyers. Contact admin for review if you think this is a mistake.',
  },
};

// @desc    List users whose profile photo awaits moderation
// @route   GET /api/admin/avatars/pending
// @access  Private (Admin only)
const getPendingAvatars = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { avatarStatus: 'PENDING' },
      select: { id: true, name: true, email: true, role: true, isActive: true, updatedAt: true },
      orderBy: { updatedAt: 'asc' },
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching pending avatars:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Shared approve/reject body: only PENDING photos can be moderated, and the
// owner is told the outcome the same way listing moderation notifies sellers.
const setAvatarStatus = async (req, res, status) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, avatarStatus: true },
  });
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  if (user.avatarStatus !== 'PENDING') {
    return res.status(409).json({ message: 'This user has no profile photo awaiting review' });
  }

  const reason = status === 'REJECTED' ? String(req.body?.reason || '').trim() || null : null;
  const updated = await prisma.user.update({
    where: { id },
    data: { avatarStatus: status, avatarRejectionReason: reason },
    select: { id: true, avatarStatus: true, avatarRejectionReason: true },
  });

  // Tell the user the verdict, mirroring LISTING_STATUS_NOTIFICATIONS.
  const { createNotification } = require('./notificationController');
  await createNotification({
    userId: id,
    type: status === 'APPROVED' ? 'PROFILE_PHOTO_APPROVED' : 'PROFILE_PHOTO_REJECTED',
    title: status === 'APPROVED' ? 'Your profile photo was approved' : 'Your profile photo was rejected',
    body: status === 'APPROVED'
      ? 'It is now visible on your profile.'
      : reason || 'It did not pass review — you can upload a different photo.',
  }).catch(() => {});

  audit.logAction({
    ...actorFrom(req),
    action: `USER.AVATAR_${status === 'APPROVED' ? 'APPROVE' : 'REJECT'}`,
    entityType: 'USER',
    entityId: id,
    meta: { userName: user.name, from: 'PENDING', to: status, ...(reason ? { reason } : {}) },
  });

  res.json({
    message: `Profile photo ${status === 'APPROVED' ? 'approved' : 'rejected'}`,
    avatarStatus: updated.avatarStatus,
  });
};

// @desc    Approve a pending profile photo
// @route   PUT /api/admin/users/:id/avatar/approve
// @access  Private (Admin only)
const approveAvatar = async (req, res) => {
  try {
    await setAvatarStatus(req, res, 'APPROVED');
  } catch (error) {
    console.error('Error approving avatar:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Reject a pending profile photo (optional { reason })
// @route   PUT /api/admin/users/:id/avatar/reject
// @access  Private (Admin only)
const rejectAvatar = async (req, res) => {
  try {
    await setAvatarStatus(req, res, 'REJECTED');
  } catch (error) {
    console.error('Error rejecting avatar:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all pending vehicle listings
// @route   GET /api/admin/vehicles/pending
// @access  Private (Admin only)
const getPendingVehicles = async (req, res) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { status: 'PENDING' },
      include: {
        images: { select: { id: true, isPrimary: true } },
        seller: {
          include: {
            user: {
              select: { name: true, email: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json(vehicles);
  } catch (error) {
    console.error('Error fetching pending vehicles:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get vehicle listings (for admin management; ?status= filters)
// @route   GET /api/admin/vehicles/all?status=AVAILABLE,DEACTIVATED
// @access  Private (Admin only)
const getAllVehicles = async (req, res) => {
  try {
    const requested = String(req.query.status || '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s) => VEHICLE_STATUSES.includes(s));
    const statuses = requested.length > 0 ? requested : ['AVAILABLE'];

    const vehicles = await prisma.vehicle.findMany({
      where: { status: { in: statuses } },
      include: {
        images: { take: 1, select: { id: true, isPrimary: true } },
        seller: {
          include: {
            user: { select: { name: true } }
          }
        }
      },
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }]
    });
    res.json(vehicles);
  } catch (error) {
    console.error('Error fetching all vehicles:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Approve, reject or take down a vehicle listing
// @route   PUT /api/admin/vehicles/:id/status
// @access  Private (Admin only)
const updateListingStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['AVAILABLE', 'REJECTED', 'DEACTIVATED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status update' });
    }

    const existing = await prisma.vehicle.findUnique({
      where: { id: parseInt(req.params.id) },
      select: { status: true, featured: true },
    });
    if (!existing) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    const vehicle = await prisma.vehicle.update({
      where: { id: parseInt(req.params.id) },
      data: { status, featured: status === 'AVAILABLE' ? undefined : false },
      include: { seller: { select: { userId: true } } }
    });
    cache.bumpVehicleVersion();

    // Tell the seller what happened to their listing.
    const ownerId = vehicle.seller?.userId;
    const notification = LISTING_STATUS_NOTIFICATIONS[status];
    if (ownerId && notification) {
      const { createNotification } = require('./notificationController');
      await createNotification({
        userId: ownerId,
        type: notification.type,
        title: notification.title,
        body: notification.body || `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim(),
        data: { vehicleId: vehicle.id },
      }).catch(() => {});
    }

    audit.logAction({
      ...actorFrom(req),
      action: `LISTING.${status === 'AVAILABLE' ? 'APPROVE' : status === 'REJECTED' ? 'REJECT' : 'DEACTIVATE'}`,
      entityType: 'VEHICLE',
      entityId: vehicle.id,
      meta: {
        title: `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim(),
        from: existing.status,
        to: status,
      },
    });

    res.json({ message: `Vehicle marked as ${status}`, vehicle });
  } catch (error) {
    console.error('Error updating vehicle status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Toggle featured status on a vehicle
// @route   PUT /api/admin/vehicles/:id/featured
// @access  Private (Admin only)
const toggleFeatured = async (req, res) => {
  try {
    const vehicleId = parseInt(req.params.id);
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

    const updated = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { featured: !vehicle.featured }
    });
    cache.bumpVehicleVersion();

    audit.logAction({
      ...actorFrom(req),
      action: 'LISTING.FEATURE',
      entityType: 'VEHICLE',
      entityId: vehicleId,
      meta: { title: `${updated.year} ${updated.make} ${updated.model}`.trim(), to: updated.featured },
    });

    res.json({ message: `Vehicle ${updated.featured ? 'featured' : 'unfeatured'}`, vehicle: updated });
  } catch (error) {
    console.error('Error toggling featured:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all users (for management)
// @route   GET /api/admin/users
// @access  Private (Admin only)
const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        verified: true,
        isActive: true,
        createdAt: true,
        sellerProfile: {
          select: { verified: true, sellerType: true, rating: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Verify a seller
// @route   PUT /api/admin/users/:id/verify
// @access  Private (Admin only)
const verifySeller = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    const user = await prisma.user.update({
      where: { id: userId },
      data: { verified: true },
    });

    if (user.role === 'SELLER') {
      await prisma.sellerProfile.update({
        where: { userId: userId },
        data: { verified: true },
      });
    }

    audit.logAction({
      ...actorFrom(req),
      action: 'USER.VERIFY',
      entityType: 'USER',
      entityId: userId,
      meta: { email: user.email },
    });

    res.json({ message: 'Seller verified successfully' });
  } catch (error) {
    console.error('Error verifying seller:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete a user
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin only)
// @desc    Delete a user (PII scrub + deactivate; records are kept)
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin only)
//
// @desc    Hard-delete a user and everything attached to them
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin only)
//
// FKs on this schema are RESTRICT, so a hard delete must be ordered: child
// rows first, then vehicles, then the seller profile, then the user. When the
// target is a seller, ALL of their listings go too — including every chat,
// favourite, report, payment and document attached to those listings, plus
// every conversation they ever held with other users.
const deleteUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, role: true, isActive: true, name: true,
        sellerProfile: { select: { id: true } },
      },
    });
    if (!target) return res.status(404).json({ message: 'User not found' });
    // Admin targets are protected first: deleting ANY admin (yourself
    // included) is 403; only then does the general self-delete rule apply.
    if (target.role === 'ADMIN') {
      return res.status(403).json({ message: 'Admin accounts cannot be deleted.' });
    }
    if (target.id === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own account.' });
    }

    // Everything they own / touched by FK, ordered leaves-to-root.
    const sellerProfileId = target.sellerProfile?.id || null;
    const vehicles = sellerProfileId
      ? await prisma.vehicle.findMany({ where: { sellerId: sellerProfileId }, select: { id: true } })
      : [];
    const vehicleIds = vehicles.map(v => v.id);
    const inVehicles = vehicleIds.length > 0;

    const ops = [
      prisma.authToken.deleteMany({ where: { userId } }),
      prisma.notification.deleteMany({ where: { userId } }),
      prisma.subscription.deleteMany({ where: { userId } }),
      prisma.review.deleteMany({ where: { OR: [
        { authorId: userId },
        ...(sellerProfileId ? [{ sellerId: sellerProfileId }] : []),
      ] } }),
      prisma.message.deleteMany({ where: { OR: [
        { senderId: userId },
        { receiverId: userId },
        ...(inVehicles ? [{ vehicleId: { in: vehicleIds } }] : []),
      ] } }),
      prisma.favorite.deleteMany({ where: { OR: [
        { userId },
        ...(inVehicles ? [{ vehicleId: { in: vehicleIds } }] : []),
      ] } }),
      prisma.payment.deleteMany({ where: { OR: [
        { userId },
        ...(inVehicles ? [{ vehicleId: { in: vehicleIds } }] : []),
      ] } }),
      prisma.report.deleteMany({ where: { OR: [
        { reporterId: userId },
        ...(inVehicles ? [{ vehicleId: { in: vehicleIds } }] : []),
      ] } }),
    ];
    if (inVehicles) {
      ops.push(
        prisma.vehicleImage.deleteMany({ where: { vehicleId: { in: vehicleIds } } }),
        prisma.vehicleFeature.deleteMany({ where: { vehicleId: { in: vehicleIds } } }),
        prisma.vehicleDocument.deleteMany({ where: { vehicleId: { in: vehicleIds } } }),
        prisma.vehicle.deleteMany({ where: { id: { in: vehicleIds } } }),
      );
    }

    let sellerProfileDeleted = 0;
    if (sellerProfileId) {
      ops.push(prisma.sellerProfile.delete({ where: { id: sellerProfileId } }));
      sellerProfileDeleted = 1;
    }
    ops.push(prisma.user.delete({ where: { id: userId } }));

    const results = await prisma.$transaction(ops);

    // Audit the deletion — but AFTER the user's audit rows are purged, so the
    // new row references only the acting admin, never the deleted user.
    const COUNT_MAP = {
      authToken: 0, notification: 1, subscription: 2, review: 3, message: 4,
      favorite: 5, payment: 6, report: 7,
    };
    const counts = { listings: vehicleIds.length, sellerProfiles: sellerProfileDeleted };
    for (const [key, idx] of Object.entries(COUNT_MAP)) counts[key] = results[idx].count || 0;

    cache.bumpVehicleVersion();
    audit.logAction({
      ...actorFrom(req),
      action: 'USER.DELETE',
      entityType: 'USER',
      entityId: userId,
      meta: { email: target.email, role: target.role, ...counts },
    });

    res.json({
      message: `User permanently deleted (removed ${counts.listings} listing(s), ${counts.message} message(s)).`,
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error deleting user' });
  }
};

// @desc    Get marketplace statistics
// @route   GET /api/admin/stats
// @access  Private (Admin only)
const getStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalSellers,
      totalBuyers,
      pendingListings,
      availableListings,
      soldListings,
      rejectedListings,
      deactivatedListings,
      removedListings,
      reservedListings,
      featuredListings,
      totalFavorites,
      totalMessages,
      pendingReports,
      totalReports,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'SELLER' } }),
      prisma.user.count({ where: { role: 'BUYER' } }),
      prisma.vehicle.count({ where: { status: 'PENDING' } }),
      prisma.vehicle.count({ where: { status: 'AVAILABLE' } }),
      prisma.vehicle.count({ where: { status: 'SOLD' } }),
      prisma.vehicle.count({ where: { status: 'REJECTED' } }),
      prisma.vehicle.count({ where: { status: 'DEACTIVATED' } }),
      prisma.vehicle.count({ where: { status: 'REMOVED' } }),
      prisma.vehicle.count({ where: { status: 'RESERVED' } }),
      prisma.vehicle.count({ where: { featured: true } }),
      prisma.favorite.count(),
      prisma.message.count(),
      prisma.report.count({ where: { status: 'PENDING' } }),
      prisma.report.count(),
    ]);

    res.json({
      users: { total: totalUsers, sellers: totalSellers, buyers: totalBuyers },
      listings: {
        pending: pendingListings,
        available: availableListings,
        sold: soldListings,
        rejected: rejectedListings,
        deactivated: deactivatedListings,
        removed: removedListings,
        reserved: reservedListings,
        featured: featuredListings,
        total: pendingListings + availableListings + soldListings + rejectedListings
          + deactivatedListings + removedListings + reservedListings,
      },
      engagement: {
        favorites: totalFavorites,
        messages: totalMessages,
      },
      reports: {
        pending: pendingReports,
        total: totalReports,
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all reports
// @route   GET /api/admin/reports
// @access  Private (Admin only)
const getReports = async (req, res) => {
  try {
    const reports = await prisma.report.findMany({
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        vehicle: { select: { id: true, make: true, model: true, year: true } },
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Resolve a report
// @route   PUT /api/admin/reports/:id/resolve
// @access  Private (Admin only)
const resolveReport = async (req, res) => {
  try {
    const report = await prisma.report.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'RESOLVED' }
    });

    audit.logAction({
      ...actorFrom(req),
      action: 'REPORT.RESOLVE',
      entityType: 'REPORT',
      entityId: report.id,
      meta: { vehicleId: report.vehicleId },
    });

    res.json({ message: 'Report resolved', report });
  } catch (error) {
    console.error('Error resolving report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all payments (bill verification queue)
// @route   GET /api/admin/payments
// @access  Private (Admin only)
const getPayments = async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        vehicle: { select: { id: true, make: true, model: true, year: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
    res.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Manually verify a payment and apply the purchased plan
// @route   PUT /api/admin/payments/:id/verify
// @access  Private (Admin only)
const verifyPayment = async (req, res) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    if (payment.status === 'VERIFIED') {
      return res.status(400).json({ message: 'Payment already verified' });
    }

    const updated = await applyVerifiedPayment(payment);
    if (!updated) {
      // Another caller (webhook/verify) applied it between our read and write
      return res.status(409).json({ message: 'Payment was already processed concurrently.' });
    }

    audit.logAction({
      ...actorFrom(req),
      action: 'PAYMENT.VERIFY',
      entityType: 'PAYMENT',
      entityId: payment.id,
      meta: { plan: payment.plan, amount: payment.amount, userId: payment.userId },
    });

    res.json({ message: `Payment verified. Plan activated.`, payment: updated });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Reject a payment (money not received / invalid reference)
// @route   PUT /api/admin/payments/:id/reject
// @access  Private (Admin only)
const rejectPayment = async (req, res) => {
  try {
    const payment = await prisma.payment.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'REJECTED' },
    });

    audit.logAction({
      ...actorFrom(req),
      action: 'PAYMENT.REJECT',
      entityType: 'PAYMENT',
      entityId: payment.id,
      meta: { plan: payment.plan, amount: payment.amount, userId: payment.userId },
    });

    res.json({ message: 'Payment rejected', payment });
  } catch (error) {
    console.error('Error rejecting payment:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Deactivate / reactivate a user account
// @route   PUT /api/admin/users/:id/status
// @access  Private (Admin only)
//
// Deactivating also takes down the user's pending/live listings so nothing
// they posted stays publicly reachable. Reactivating deliberately does NOT
// restore listings — the admin re-enables each one from the listings screen.
const setUserStatus = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { isActive } = req.body;

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    if (!target) return res.status(404).json({ message: 'User not found' });
    if (target.id === req.user.id) {
      return res.status(400).json({ message: 'You cannot change the status of your own account.' });
    }
    if (target.role === 'ADMIN') {
      return res.status(403).json({ message: 'Admin accounts cannot be deactivated.' });
    }
    if (target.isActive === isActive) {
      return res.status(400).json({ message: `Account is already ${isActive ? 'active' : 'deactivated'}.` });
    }

    let listingsAffected = 0;
    if (!isActive) {
      const [, vehicles] = await prisma.$transaction([
        prisma.user.update({ where: { id: userId }, data: { isActive: false } }),
        prisma.vehicle.updateMany({
          where: { seller: { userId }, status: { in: ['PENDING', 'AVAILABLE'] } },
          data: { status: 'DEACTIVATED', featured: false },
        }),
      ]);
      listingsAffected = vehicles.count;

      const { createNotification } = require('./notificationController');
      await createNotification({
        userId,
        type: 'SYSTEM',
        title: 'Your account was deactivated',
        body: 'Your listings are no longer visible to buyers. Contact support for help.',
      }).catch(() => {});
    } else {
      await prisma.user.update({ where: { id: userId }, data: { isActive: true } });
    }
    cache.bumpVehicleVersion();

    audit.logAction({
      ...actorFrom(req),
      action: isActive ? 'USER.REACTIVATE' : 'USER.DEACTIVATE',
      entityType: 'USER',
      entityId: userId,
      meta: { email: target.email, listingsAffected },
    });

    res.json({
      message: `Account ${isActive ? 'reactivated' : 'deactivated'}`,
      user: { id: userId, isActive },
      listingsAffected,
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Audit trail of admin and listing actions
// @route   GET /api/admin/audit-logs?page=&limit=&action=&entityType=&entityId=&actorId=&from=&to=
// @access  Private (Admin only)
const getAuditLogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const where = {};
    // Prefix match so "?action=LISTING." covers every listing action.
    if (req.query.action) where.action = { startsWith: String(req.query.action) };
    if (req.query.entityType) where.entityType = String(req.query.entityType).toUpperCase();
    if (req.query.entityId) where.entityId = parseInt(req.query.entityId, 10) || undefined;
    if (req.query.actorId) where.actorId = parseInt(req.query.actorId, 10) || undefined;
    if (req.query.from || req.query.to) {
      where.createdAt = {
        ...(req.query.from ? { gte: new Date(String(req.query.from)) } : {}),
        ...(req.query.to ? { lte: new Date(String(req.query.to)) } : {}),
      };
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      logs,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    All purchase orders — escrow/payout queue first, newest last.
//          Each row carries commission/payout breakdown for the payout view.
// @route   GET /api/admin/purchases
// @access  Private (Admin only)
const getPurchases = async (req, res) => {
  try {
    const purchases = await prisma.purchase.findMany({
      include: {
        buyer: { select: { id: true, name: true, email: true, phone: true } },
        vehicle: { select: { id: true, make: true, model: true, year: true } },
        seller: {
          select: {
            payoutMethod: true, payoutAccount: true, payoutName: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
      // payoutStatus PENDING first (admins need to action them), then newest
      orderBy: [{ payoutStatus: 'asc' }, { createdAt: 'desc' }],
    });
    res.json(purchases.map((p) => ({
      ...p,
      commission: commissionFor(p),
      payoutAmount: p.amount - commissionFor(p),
    })));
  } catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Mark an escrow payout as sent (manual transfer made off-platform)
// @route   PUT /api/admin/purchases/:id/release-payout
// @access  Private (Admin only)
const releasePayout = async (req, res) => {
  try {
    const { payoutRef } = req.body || {};
    const purchase = await prisma.purchase.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!purchase) return res.status(404).json({ message: 'Purchase not found' });
    if (purchase.status !== 'COMPLETED') {
      return res.status(400).json({ message: 'Payouts only release once the order is COMPLETED' });
    }
    if (purchase.payoutStatus !== 'PENDING') {
      return res.status(400).json({ message: `Cannot release a payout that is ${purchase.payoutStatus}` });
    }

    const updated = await prisma.purchase.update({
      where: { id: purchase.id },
      data: {
        payoutStatus: 'SENT',
        payoutRef: payoutRef || null,
      },
    });

    audit.logAction({
      ...actorFrom(req),
      action: 'PURCHASE.RELEASE_PAYOUT',
      entityType: 'PURCHASE',
      entityId: purchase.id,
      meta: { reference: purchase.reference, amount: purchase.amount, payoutRef: payoutRef || null },
    });

    res.json({ message: 'Payout marked sent', purchase: updated });
  } catch (error) {
    console.error('Error releasing payout:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getPendingVehicles,
  getAllVehicles,
  updateListingStatus,
  toggleFeatured,
  getAllUsers,
  verifySeller,
  deleteUser,
  setUserStatus,
  getAuditLogs,
  getStats,
  getReports,
  resolveReport,
  getPayments,
  verifyPayment,
  rejectPayment,
  getPendingAvatars,
  approveAvatar,
  rejectAvatar,
  getPurchases,
  releasePayout,
};
