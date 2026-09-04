const express = require('express');
const router = express.Router();
const { register, login, googleLogin, getMe, upgradeToSeller, forgotPassword, resetPassword, logout } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
const { validate } = require('../middlewares/validation');
const { registerSchema, loginSchema, upgradeToSellerSchema, emailOnlySchema, resetPasswordSchema } = require('../middlewares/validation');

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/google', googleLogin);
router.post('/forgot-password', validate(emailOnlySchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);
router.post('/logout', logout);
router.get('/me', protect, getMe);
router.put('/upgrade', protect, validate(upgradeToSellerSchema), upgradeToSeller);

module.exports = router;
