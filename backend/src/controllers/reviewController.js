const prisma = require('../config/db');

// Transaction-verified seller reviews: only a buyer who COMPLETED a purchase
// from a seller can leave a review, and only one per purchase. This makes
// every star traceable to a real escrowed sale — something anonymous
// classifieds like Jiji structurally cannot match.

// @desc    Leave a review for a seller after a completed purchase
// @route   POST /api/reviews
// @access  Private (Buyer, own completed purchase)
const createReview = async (req, res) => {
  try {
    const { purchaseId, rating, comment } = req.body;
    const stars = parseInt(rating, 10);

    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5 stars.' });
    }

    const purchase = await prisma.purchase.findUnique({
      where: { id: parseInt(purchaseId, 10) },
      include: { review: true },
    });
    if (!purchase) return res.status(404).json({ message: 'Purchase not found.' });
    if (purchase.buyerId !== req.user.id) {
      return res.status(403).json({ message: 'You can only review your own purchases.' });
    }
    if (purchase.status !== 'COMPLETED') {
      return res.status(400).json({ message: `You can only review completed orders (this one is ${purchase.status}).` });
    }
    if (purchase.review) {
      return res.status(409).json({ message: 'You already reviewed this transaction.' });
    }

    const review = await prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          authorId: req.user.id,
          sellerId: purchase.sellerId,
          purchaseId: purchase.id,
          rating: stars,
          comment: comment ? String(comment).trim().slice(0, 1000) : null,
        },
      });

      // Recompute the seller's aggregate rating in one shot
      const agg = await tx.review.aggregate({
        where: { sellerId: purchase.sellerId },
        _avg: { rating: true },
        _count: { rating: true },
      });
      await tx.sellerProfile.update({
        where: { id: purchase.sellerId },
        data: { rating: Math.round((agg._avg.rating ?? 0) * 10) / 10 },
      });

      return created;
    }, { maxWait: 15000, timeout: 15000 });

    res.status(201).json({ review });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ message: 'Server error creating review' });
  }
};

// @desc    Get all reviews for a seller (public — no auth)
// @route   GET /api/reviews/seller/:sellerId
// @access  Public
const getSellerReviews = async (req, res) => {
  try {
    const sellerId = parseInt(req.params.sellerId, 10);
    const reviews = await prisma.review.findMany({
      where: { sellerId },
      include: {
        author: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const seller = await prisma.sellerProfile.findUnique({
      where: { id: sellerId },
      select: { rating: true, verified: true },
    });

    res.json({
      reviews,
      rating: seller?.rating ?? 0,
      reviewCount: reviews.length,
      verified: Boolean(seller?.verified),
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ message: 'Server error fetching reviews' });
  }
};

// @desc    Which of the caller's completed purchases can still be reviewed?
//          (powers the "leave a review" prompts on the order page)
// @route   GET /api/reviews/eligible
// @access  Private
const getEligibleReviews = async (req, res) => {
  try {
    const purchases = await prisma.purchase.findMany({
      where: { buyerId: req.user.id, status: 'COMPLETED' },
      include: {
        review: { select: { id: true } },
        vehicle: { select: { id: true, make: true, model: true, year: true } },
        seller: { include: { user: { select: { name: true } } } },
      },
      orderBy: { completedAt: 'desc' },
    });
    res.json({
      eligible: purchases.filter((p) => !p.review),
      reviewed: purchases.filter((p) => Boolean(p.review)),
    });
  } catch (error) {
    console.error('Error fetching eligible reviews:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createReview, getSellerReviews, getEligibleReviews };
