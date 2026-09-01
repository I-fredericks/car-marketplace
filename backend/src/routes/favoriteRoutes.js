const express = require('express');
const router = express.Router();
const { addFavorite, removeFavorite, getFavorites } = require('../controllers/favoriteController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/:vehicleId', protect, addFavorite);
router.delete('/:vehicleId', protect, removeFavorite);
router.get('/', protect, getFavorites);

module.exports = router;
