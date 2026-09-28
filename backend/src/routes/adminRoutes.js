const express = require('express');
const router = express.Router();
const {
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
  broadcastNotification,
  bulkMessageUsers,
  approveAvatar,
  rejectAvatar,
  getPurchases,
  releasePayout,
  verifyPurchasePayment,
  rejectPurchasePayment,
  resolveDispute,
  createStaff,
} = require('../controllers/adminController');
const { protect, requirePermission, requireRole } = require('../middlewares/authMiddleware');
const { validate } = require('../middlewares/validation');
const {
  updateListingStatusSchema,
  updateUserStatusSchema,
  broadcastSchema,
  bulkMessageSchema,
  createStaffSchema,
} = require('../middlewares/validation');

router.use(protect);

router.get('/stats', requirePermission('stats:read'), getStats);

router.get('/vehicles/pending', requirePermission('vehicles:read'), getPendingVehicles);
router.get('/vehicles/all', requirePermission('vehicles:read'), getAllVehicles);
router.put('/vehicles/:id/status', requirePermission('vehicles:write'), validate(updateListingStatusSchema), updateListingStatus);
router.put('/vehicles/:id/featured', requirePermission('vehicles:write'), toggleFeatured);

router.get('/users', requirePermission('users:read'), getAllUsers);
router.get('/avatars/pending', requirePermission('avatars:read'), getPendingAvatars);
router.put('/users/:id/avatar/approve', requirePermission('avatars:moderate'), approveAvatar);
router.put('/users/:id/avatar/reject', requirePermission('avatars:moderate'), rejectAvatar);

router.post('/broadcast', requirePermission('broadcast:write'), validate(broadcastSchema), broadcastNotification);
router.post('/messages/bulk', requirePermission('broadcast:write'), validate(bulkMessageSchema), bulkMessageUsers);

router.put('/users/:id/verify', requirePermission('users:moderate'), verifySeller);
router.put('/users/:id/status', requirePermission('users:write'), validate(updateUserStatusSchema), setUserStatus);
router.delete('/users/:id', requirePermission('users:write'), deleteUser);

router.get('/audit-logs', requireRole('ADMIN'), getAuditLogs);

router.get('/reports', requirePermission('reports:read'), getReports);
router.put('/reports/:id/resolve', requirePermission('reports:write'), resolveReport);

router.get('/payments', requirePermission('payments:read'), getPayments);
router.put('/payments/:id/verify', requirePermission('payments:write'), verifyPayment);
router.put('/payments/:id/reject', requirePermission('payments:write'), rejectPayment);

router.get('/purchases', requirePermission('purchases:read'), getPurchases);
router.put('/purchases/:id/verify-payment', requirePermission('purchases:write'), verifyPurchasePayment);
router.put('/purchases/:id/reject-payment', requirePermission('purchases:write'), rejectPurchasePayment);
router.put('/purchases/:id/resolve-dispute', requirePermission('disputes:write'), resolveDispute);
router.put('/purchases/:id/release-payout', requirePermission('payouts:write'), releasePayout);

router.post('/staff', requireRole('ADMIN'), validate(createStaffSchema), createStaff);

module.exports = router;