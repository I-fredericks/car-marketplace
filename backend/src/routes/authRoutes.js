const express = require('express');
const router = express.Router();
const { register, login, googleLogin, getMe, upgradeToSeller, forgotPassword, resetPassword, verifyEmail, resendVerification, changePassword, logout, updateProfile } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
const { validate } = require('../middlewares/validation');
const { registerSchema, loginSchema, upgradeToSellerSchema, emailOnlySchema, resetPasswordSchema, changePasswordSchema, updateProfileSchema } = require('../middlewares/validation');

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/google', googleLogin);
router.post('/forgot-password', validate(emailOnlySchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

// Email confirmation: the link from the inbox (HTML page) + resend request
// (JSON, generic response so it can't be used to probe registered addresses).
router.get('/verify-email', verifyEmail);
router.post('/resend-verification', validate(emailOnlySchema), resendVerification);
router.post('/logout', logout);
router.get('/me', protect, getMe);
router.put('/upgrade', protect, validate(upgradeToSellerSchema), upgradeToSeller);
router.put('/profile', protect, validate(updateProfileSchema), updateProfile);
router.put('/change-password', protect, validate(changePasswordSchema), changePassword);

module.exports = router;
