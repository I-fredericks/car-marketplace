const express = require('express');
const router = express.Router();
const { register, login, getMe, upgradeToSeller, logout } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
const { validate } = require('../middlewares/validation');
const { registerSchema, loginSchema, upgradeToSellerSchema } = require('../middlewares/validation');

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/logout', logout);
router.get('/me', protect, getMe);
router.put('/upgrade', protect, validate(upgradeToSellerSchema), upgradeToSeller);

module.exports = router;
