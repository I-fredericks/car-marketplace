const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { sendPasswordResetEmail, smtpConfigured } = require('../services/mailer');

const RESET_TOKEN_MINUTES = 60;

// Create a single-use token for email flows; only its hash is stored
const createAuthToken = async (userId, type, ttlMinutes) => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await prisma.authToken.create({
    data: {
      userId,
      type,
      tokenHash,
      expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
    },
  });
  return rawToken;
};

const findValidAuthToken = async (rawToken, type) => {
  if (!rawToken || typeof rawToken !== 'string') return null;
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const record = await prisma.authToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!record || record.type !== type || record.expiresAt <= new Date()) return null;
  return record;
};

const register = async (req, res) => {
  try {
    const { email, password, name, phone, role, sellerType } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
        role: role || 'BUYER',
      },
    });

    if (user.role === 'SELLER') {
      await prisma.sellerProfile.create({
        data: {
          userId: user.id,
          sellerType: ['PRIVATE', 'DEALER', 'COMPANY'].includes(sellerType) ? sellerType : 'PRIVATE',
        },
      });
    }

    // Accounts are active immediately; no email activation required
    res.status(201).json({ message: 'User registered successfully', userId: user.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get current logged in user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        sellerProfile: true, // Bring in seller details if they exist
      },
    });
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Upgrade a Buyer account to a Seller account
// @route   PUT /api/auth/upgrade
// @access  Private
const upgradeToSeller = async (req, res) => {
  try {
    if (req.user.role === 'SELLER' || req.user.role === 'ADMIN') {
      return res.status(400).json({ message: 'User is already a seller or admin' });
    }

    const { whatsapp, location, sellerType } = req.body;

    // Update user role and create a seller profile in a transaction
    const [updatedUser, sellerProfile] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: { role: 'SELLER' },
      }),
      prisma.sellerProfile.create({
        data: {
          userId: req.user.id,
          whatsapp,
          location,
          sellerType: sellerType || 'PRIVATE',
        },
      }),
    ]);

    // Generate a fresh token with the new role
    const token = jwt.sign(
      { id: updatedUser.id, role: updatedUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Account upgraded to seller successfully',
      token,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        role: updatedUser.role,
      },
      sellerProfile
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during upgrade' });
  }
};

// Verify an ID token with Google (signature, expiry, audience) with retries
// to ride out transient network drops
const verifyGoogleToken = async (credential) => {
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await fetch(url, { signal: AbortSignal.timeout(8000) });
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  throw lastError;
};

// @desc    Sign in / sign up with a Google ID token (Google Identity Services)
// @route   POST /api/auth/google
// @access  Public
const googleLogin = async (req, res) => {
  try {
    const { credential, role, sellerType } = req.body;
    if (!credential) {
      return res.status(400).json({ message: 'Missing Google credential' });
    }

    let verifyRes;
    try {
      verifyRes = await verifyGoogleToken(credential);
    } catch {
      return res.status(502).json({ message: 'Could not reach Google to verify the sign-in. Check your network.' });
    }
    if (!verifyRes.ok) {
      return res.status(401).json({ message: 'Invalid Google token' });
    }
    const info = await verifyRes.json();

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId || info.aud !== clientId) {
      return res.status(401).json({ message: 'Google token was not issued for this app' });
    }
    if (info.email_verified !== 'true' && info.email_verified !== true) {
      return res.status(401).json({ message: 'Google account email is not verified' });
    }

    // Find or create the local account (random unusable password for Google accounts)
    let user = await prisma.user.findUnique({ where: { email: info.email } });
    if (!user) {
      const randomPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      user = await prisma.user.create({
        data: {
          email: info.email,
          name: info.name || info.email.split('@')[0],
          phone: null,
          password: randomPassword,
          role: role === 'SELLER' ? 'SELLER' : 'BUYER',
          emailVerified: true, // Google already confirmed this address
        },
      });
      if (user.role === 'SELLER') {
        await prisma.sellerProfile.create({
          data: {
            userId: user.id,
            sellerType: ['PRIVATE', 'DEALER', 'COMPANY'].includes(sellerType) ? sellerType : 'PRIVATE',
          },
        });
      }
    } else if (!user.emailVerified) {
      // Google has confirmed control of this address
      user = await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({ message: 'Server error during Google sign-in' });
  }
};

// @desc    Request a password reset link
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      await prisma.authToken.deleteMany({ where: { userId: user.id, type: 'PASSWORD_RESET' } });
      const rawToken = await createAuthToken(user.id, 'PASSWORD_RESET', RESET_TOKEN_MINUTES);
      try {
        await sendPasswordResetEmail(user, rawToken);
      } catch (error) {
        console.error('Failed to send reset email:', error.message);
      }
      return res.json({
        message: 'If that email is registered, a password reset link has been sent. It expires in 1 hour.',
        ...(smtpConfigured || process.env.NODE_ENV === 'production' ? {} : { devResetToken: rawToken }),
      });
    }

    res.json({ message: 'If that email is registered, a password reset link has been sent. It expires in 1 hour.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error processing password reset' });
  }
};

// @desc    Set a new password using a reset token
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    const record = await findValidAuthToken(token, 'PASSWORD_RESET');
    if (!record) {
      return res.status(400).json({ message: 'This reset link is invalid or has expired. Please request a new one.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { password: hashedPassword } }),
      prisma.authToken.deleteMany({ where: { userId: record.userId } }),
    ]);

    res.json({ message: 'Password has been reset successfully. You can now log in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error resetting password' });
  }
};

const logout = (req, res) => {
  res.json({ message: 'Logged out successfully' });
};

module.exports = {
  register,
  login,
  googleLogin,
  getMe,
  upgradeToSeller,
  forgotPassword,
  resetPassword,
  logout
};
