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
  approveAvatar,
  rejectAvatar,
  getPurchases,
  releasePayout,
  verifyPurchasePayment,
  rejectPurchasePayment,
} = require('../controllers/adminController');
const { protect, admin } = require('../middlewares/authMiddleware');
const { validate } = require('../middlewares/validation');
const {
  updateListingStatusSchema,
  updateUserStatusSchema,
} = require('../middlewares/validation');

router.use(protect, admin);

// Stats
router.get('/stats', getStats);

// Vehicle management
router.get('/vehicles/pending', getPendingVehicles);
router.get('/vehicles/all', getAllVehicles);
router.put('/vehicles/:id/status', validate(updateListingStatusSchema), updateListingStatus);
router.put('/vehicles/:id/featured', toggleFeatured);

// User management
router.get('/users', getAllUsers);

// Profile photo moderation (registered before /users/:id/* so the 3-segment
// path never collides with status/verify handlers).
router.get('/avatars/pending', getPendingAvatars);
router.put('/users/:id/avatar/approve', approveAvatar);
router.put('/users/:id/avatar/reject', rejectAvatar);

router.put('/users/:id/verify', verifySeller);
router.put('/users/:id/status', validate(updateUserStatusSchema), setUserStatus);
router.delete('/users/:id', deleteUser);

// Audit trail
router.get('/audit-logs', getAuditLogs);

// Reports
router.get('/reports', getReports);
router.put('/reports/:id/resolve', resolveReport);

// Payments (billing verification)
router.get('/payments', getPayments);
router.put('/payments/:id/verify', verifyPayment);
router.put('/payments/:id/reject', rejectPayment);

// Purchases (escrow orders + transfer confirmation + payout release)
router.get('/purchases', getPurchases);
router.put('/purchases/:id/verify-payment', verifyPurchasePayment);
router.put('/purchases/:id/reject-payment', rejectPurchasePayment);
router.put('/purchases/:id/release-payout', releasePayout);

module.exports = router;
