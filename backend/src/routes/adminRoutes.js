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
  getStats,
  getReports,
  resolveReport,
  getPayments,
  verifyPayment,
  rejectPayment,
} = require('../controllers/adminController');
const { protect, admin } = require('../middlewares/authMiddleware');
const { validate } = require('../middlewares/validation');
const { updateListingStatusSchema } = require('../middlewares/validation');

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
router.put('/users/:id/verify', verifySeller);
router.delete('/users/:id', deleteUser);

// Reports
router.get('/reports', getReports);
router.put('/reports/:id/resolve', resolveReport);

// Payments (billing verification)
router.get('/payments', getPayments);
router.put('/payments/:id/verify', verifyPayment);
router.put('/payments/:id/reject', rejectPayment);

module.exports = router;
