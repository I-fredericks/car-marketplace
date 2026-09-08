const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { makeOffer, respondToOffer, withdrawOffer, getOfferThread, getPayablePrice } = require('../controllers/offerController');

router.use(protect);

router.post('/', makeOffer);
router.get('/', getOfferThread);
router.get('/price/:vehicleId', getPayablePrice);
router.post('/:id/respond', respondToOffer);
router.post('/:id/withdraw', withdrawOffer);

module.exports = router;
