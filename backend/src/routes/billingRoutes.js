const express = require('express');
const router = express.Router();
const { protect, seller } = require('../middlewares/authMiddleware');
const {
  getPlans,
  getBillingStatus,
  createPayment,
  initializePayment,
  verifyPayment,
  paystackWebhook,
  getMyPayments,
} = require('../controllers/billingController');

// Public (signature-verified inside the handler)
router.post('/webhook', paystackWebhook);

// Public pricing info
router.get('/plans', getPlans);

// Seller billing
router.get('/status', protect, seller, getBillingStatus);
router.get('/payments', protect, seller, getMyPayments);
router.post('/payments', protect, seller, createPayment);
router.post('/payments/:id/initialize', protect, seller, initializePayment);
router.get('/verify/:reference', protect, seller, verifyPayment);

module.exports = router;
