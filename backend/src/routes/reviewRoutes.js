const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middlewares/authMiddleware');
const { createReview, getSellerReviews, getEligibleReviews } = require('../controllers/reviewController');

// Public: anyone can read a seller's reviews
router.get('/seller/:sellerId', getSellerReviews);

// Authenticated: buyer leaves a review / checks eligibility
router.get('/eligible', protect, getEligibleReviews);
router.post('/', protect, createReview);

module.exports = router;
