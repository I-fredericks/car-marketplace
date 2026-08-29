const express = require('express');
const router = express.Router();
const { createVehicle, getVehicles, getVehicleById, updateVehicle, deleteVehicle } = require('../controllers/vehicleController');
const { protect, seller } = require('../middlewares/authMiddleware');

// Public routes
router.get('/', getVehicles);
router.get('/:id', getVehicleById);

// Protected routes (Requires login and Seller profile)
router.post('/', protect, seller, createVehicle);
router.put('/:id', protect, seller, updateVehicle);
router.delete('/:id', protect, seller, deleteVehicle);

module.exports = router;
