const express = require('express');
const router = express.Router();
const { 
  getPendingVehicles, 
  updateListingStatus, 
  getAllUsers, 
  verifySeller, 
  deleteUser 
} = require('../controllers/adminController');
const { protect, admin } = require('../middlewares/authMiddleware');

// All routes here are protected and require admin role
router.use(protect, admin);

// Listing approvals
router.get('/vehicles/pending', getPendingVehicles);
router.put('/vehicles/:id/status', updateListingStatus);

// User management
router.get('/users', getAllUsers);
router.put('/users/:id/verify', verifySeller);
router.delete('/users/:id', deleteUser);

module.exports = router;
