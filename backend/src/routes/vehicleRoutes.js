const express = require('express');
const router = express.Router();
const { createVehicle, getVehicles, getVehicleById, getFeaturedCars, getSellerListings, updateVehicle, markAsSold, deleteVehicle, reactivateVehicle } = require('../controllers/vehicleController');
const { protect, seller, optionalAuth } = require('../middlewares/authMiddleware');
const { validate } = require('../middlewares/validation');
const { vehicleSchema, updateVehicleSchema } = require('../middlewares/validation');

router.get('/', getVehicles);
router.get('/featured', getFeaturedCars);
router.get('/:id', optionalAuth, getVehicleById);
router.get('/seller/my-listings', protect, seller, getSellerListings);

router.post('/', protect, seller, validate(vehicleSchema), createVehicle);
router.put('/:id', protect, seller, validate(updateVehicleSchema), updateVehicle);
router.put('/:id/sold', protect, seller, markAsSold);
router.put('/:id/reactivate', protect, seller, reactivateVehicle);
router.delete('/:id', protect, seller, deleteVehicle);

module.exports = router;
