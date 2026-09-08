const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
  initiatePurchase,
  initializePurchasePayment,
  verifyPurchase,
  confirmReceived,
  confirmHandover,
  sellerCollected,
  cancelPurchase,
  listPurchases,
  getPurchase,
} = require('../controllers/purchaseController');

// All purchase endpoints require a signed-in user (buyer or seller).
router.use(protect);

router.post('/', initiatePurchase);
router.get('/', listPurchases);
router.get('/:id', getPurchase);
router.post('/:id/initialize', initializePurchasePayment);
router.get('/:id/verify', verifyPurchase);
router.post('/:id/confirm-received', confirmReceived);
router.post('/:id/confirm-handover', confirmHandover);
router.post('/:id/seller-collected', sellerCollected);
router.post('/:id/cancel', cancelPurchase);

module.exports = router;
