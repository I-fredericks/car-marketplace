const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { sendPasswordResetEmail, sendVerificationEmail, smtpConfigured, originFromReq, appUrl } = require('../services/mailer');

const RESET_TOKEN_MINUTES = 60;
const VERIFICATION_TOKEN_MINUTES = 24 * 60; // confirmation links live for a day

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

// One verification token per account: issuing a new link retires the old ones.
// Kept as its own function so register and resend-verification can't drift.
const issueVerificationToken = async (user, origin) => {
  await prisma.authToken.deleteMany({ where: { userId: user.id, type: 'EMAIL_VERIFICATION' } });
  const rawToken = await createAuthToken(user.id, 'EMAIL_VERIFICATION', VERIFICATION_TOKEN_MINUTES);
  await sendVerificationEmail(user, rawToken, origin);
  return rawToken;
};

// Self-contained HTML for the verify-email GET (the link opens in whatever
// browser is on the phone; there is no app deep-link requirement).
const verifyPage = (title, message, ok) => `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — CarMarket Ghana</title></head>
<body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#F4F6F9;display:flex;justify-content:center;padding:40px 16px;">
  <div style="max-width:440px;background:#fff;border-radius:16px;padding:32px 28px;text-align:center;box-shadow:0 2px 12px rgba(27,42,74,.08);">
    <div style="font-size:44px;margin-bottom:8px;">${ok ? '&#10004;' : '&#10006;'}</div>
    <h2 style="color:#1B2A4A;margin:0 0 10px;">${title}</h2>
    <p style="color:#4B5563;line-height:1.6;margin:0 0 20px;">${message}</p>
    ${ok ? `<p style="margin:0 0 20px;">
      <a href="${appUrl()}/login" style="background:#1B2A4A;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">Continue to sign in</a>
    </p>` : '<p style="color:#9CA3AF;font-size:12px;">Open the app and use "Resend verification email" to get a new link.</p>'}
    <p style="color:#1B2A4A;font-weight:bold;font-size:13px;margin-top:24px;">CarMarket Ghana</p>
  </div>
</body></html>`;

const register = async (req, res) => {
  try {
    // Without SMTP in production the verification link can never arrive, so
    // sign-up would create permanently locked accounts. Fail loudly instead,
    // mirroring the forgot-password guard.
    if (process.env.NODE_ENV === 'production' && !smtpConfigured) {
      return res.status(503).json({ message: 'Registration is temporarily unavailable. Please contact support.' });
    }

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

    // Account is created but cannot sign in until the email is confirmed.
    let devVerificationToken;
    try {
      const rawToken = await issueVerificationToken(user, originFromReq(req));
      if (!smtpConfigured && process.env.NODE_ENV !== 'production') {
        devVerificationToken = rawToken;
      }
    } catch (error) {
      console.error('Failed to send verification email:', error.message);
    }

    res.status(201).json({
      message: 'User registered successfully',
      userId: user.id,
      requiresEmailVerification: true,
      ...(devVerificationToken ? { devVerificationToken } : {}),
    });
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

    if (!user.isActive) {
      return res.status(403).json({ message: 'This account has been deactivated. Please contact support.' });
    }

    // Credentials are valid but the mailbox was never confirmed. The client
    // shows the resend flow keyed on `emailNotVerified` in the body.
    if (!user.emailVerified) {
      return res.status(403).json({
        message: 'Please confirm your email address before signing in. Check your inbox for the confirmation link.',
        emailNotVerified: true,
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
        isActive: true,
        // Profile photo state (the image itself loads from /api/users/:id/avatar).
        avatarStatus: true,
        avatarRejectionReason: true,
        updatedAt: true, // clients cache-bust avatar URLs with this
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

    if (!user.isActive) {
      return res.status(403).json({ message: 'This account has been deactivated. Please contact support.' });
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

    // Without SMTP in production the link can never be delivered — fail
    // loudly rather than acknowledging a reset that silently goes nowhere.
    if (process.env.NODE_ENV === 'production' && !smtpConfigured) {
      return res.status(503).json({ message: 'Password reset is temporarily unavailable. Please contact support.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      await prisma.authToken.deleteMany({ where: { userId: user.id, type: 'PASSWORD_RESET' } });
      const rawToken = await createAuthToken(user.id, 'PASSWORD_RESET', RESET_TOKEN_MINUTES);
      try {
        await sendPasswordResetEmail(user, rawToken, originFromReq(req));
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

// @desc    Browser entry point for the email reset link — a self-contained
//          HTML form (no web frontend needed, works on any phone)
// @route   GET /api/auth/reset-password?token=...
// @access  Public
const resetPasswordPage = async (req, res) => {
  const token = String(req.query.token || '');
  if (token.length < 10) {
    return res.status(400).send(verifyPage(
      'Invalid reset link',
      'This password reset link is malformed. Request a new one from the app.',
      false,
    ));
  }
  res.send(`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reset password — CarMarket Ghana</title></head>
<body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#F4F6F9;display:flex;justify-content:center;padding:40px 16px;">
  <div style="max-width:440px;width:100%;background:#fff;border-radius:16px;padding:32px 28px;box-shadow:0 2px 12px rgba(27,42,74,.08);">
    <h2 style="color:#1B2A4A;margin:0 0 6px;">Choose a new password</h2>
    <p style="color:#4B5563;line-height:1.6;margin:0 0 20px;font-size:14px;">CarMarket Ghana — this link expires in 1 hour.</p>
    <div id="form">
      <input id="pw1" type="password" placeholder="New password (min 6 characters)"
        style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #D1D5DB;border-radius:8px;font-size:15px;margin-bottom:12px;">
      <input id="pw2" type="password" placeholder="Confirm new password"
        style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #D1D5DB;border-radius:8px;font-size:15px;margin-bottom:16px;">
      <p id="msg" style="color:#DC2626;font-size:13px;min-height:18px;margin:0 0 10px;"></p>
      <button id="btn" onclick="submitReset()"
        style="width:100%;background:#1B2A4A;color:#fff;padding:13px;border:none;border-radius:8px;font-size:15px;font-weight:bold;cursor:pointer;">Set new password</button>
    </div>
    <div id="done" style="display:none;text-align:center;">
      <div style="font-size:44px;margin-bottom:8px;">&#10004;</div>
      <h3 style="color:#1B2A4A;">Password updated</h3>
      <p style="color:#4B5563;margin:0 0 20px;">Your new password is active.</p>
      <a href="${appUrl()}/login" style="background:#1B2A4A;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">Go to sign in</a>
    </div>
  </div>
<script>
async function submitReset() {
  const pw1 = document.getElementById('pw1').value;
  const pw2 = document.getElementById('pw2').value;
  const msg = document.getElementById('msg');
  const btn = document.getElementById('btn');
  msg.textContent = '';
  if (pw1.length < 6) { msg.textContent = 'Password must be at least 6 characters.'; return; }
  if (pw1 !== pw2) { msg.textContent = 'Passwords do not match.'; return; }
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: ${JSON.stringify(token)}, password: pw1 }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { msg.textContent = data.message || 'Something went wrong. Please try again.'; }
    else {
      document.getElementById('form').style.display = 'none';
      document.getElementById('done').style.display = 'block';
      return;
    }
  } catch {
    msg.textContent = 'No connection. Check your internet and try again.';
  }
  btn.disabled = false; btn.textContent = 'Set new password';
}
</script>
</body></html>`);
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
      // Completing a reset proves mailbox control, so it also verifies the
      // email — otherwise a reset would leave the account still locked.
      prisma.user.update({
        where: { id: record.userId },
        data: { password: hashedPassword, emailVerified: true },
      }),
      prisma.authToken.deleteMany({ where: { userId: record.userId } }),
    ]);

    res.json({ message: 'Password has been reset successfully. You can now log in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error resetting password' });
  }
};

// @desc    Confirm an email address from the inbox link
// @route   GET /api/auth/verify-email?token=...
// @access  Public — returns an HTML page, not JSON (inboxes open in browsers)
const verifyEmail = async (req, res) => {
  try {
    const record = await findValidAuthToken(req.query.token, 'EMAIL_VERIFICATION');
    if (record) {
      await prisma.$transaction([
        prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
        prisma.authToken.deleteMany({ where: { userId: record.userId, type: 'EMAIL_VERIFICATION' } }),
      ]);
      return res.send(verifyPage('Email confirmed', 'Your CarMarket Ghana account is now active. Welcome aboard!', true));
    }

    // An already-verified account clicking a stale link is a success, not an
    // error — otherwise every double-click in the inbox looks broken.
    return res.status(400).send(verifyPage(
      'Link expired or already used',
      'This confirmation link is no longer valid. If you already confirmed your email, just sign in.',
      false,
    ));
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).send(verifyPage('Something went wrong', 'We could not confirm your email. Please try again later.', false));
  }
};

// @desc    Send a new confirmation link
// @route   POST /api/auth/resend-verification
// @access  Public — response never reveals whether the address is registered
const resendVerification = async (req, res) => {
  try {
    // Same production trap as register: no SMTP means the link goes nowhere.
    if (process.env.NODE_ENV === 'production' && !smtpConfigured) {
      return res.status(503).json({ message: 'Email verification is temporarily unavailable. Please contact support.' });
    }

    const { email } = req.body || {};
    const message = 'If an unverified account exists for that email, a new confirmation link has been sent.';

    const user = typeof email === 'string'
      ? await prisma.user.findUnique({ where: { email: email.trim() } })
      : null;

    if (user && !user.emailVerified) {
      try {
        const rawToken = await issueVerificationToken(user, originFromReq(req));
        return res.json({
          message,
          ...(!smtpConfigured && process.env.NODE_ENV !== 'production' ? { devVerificationToken: rawToken } : {}),
        });
      } catch (error) {
        console.error('Failed to resend verification email:', error.message);
      }
    }

    res.json({ message });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Change password for the signed-in user (needs the current one)
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Google-only accounts carry a random unusable hash, so this check can
    // never pass for them — the copy nudges them to the reset flow instead.
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        message: 'Current password is incorrect. If you signed up with Google, use "Forgot password" to set a password first.',
      });
    }

    if (newPassword === currentPassword) {
      return res.status(400).json({ message: 'The new password must be different from the current one.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    // Any pending reset/verification links are retired too: the password just
    // changed, and old links should no longer be able to change it back.
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } }),
      prisma.authToken.deleteMany({ where: { userId: user.id } }),
    ]);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const logout = (req, res) => {
  res.json({ message: 'Logged out successfully' });
};

// @desc    Update current user's profile (name, phone, seller fields)
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { name, phone, whatsapp, location, sellerType } = req.body;
    const userId = req.user.id;

    const userUpdate = {};
    if (typeof name === 'string') userUpdate.name = name.trim();
    if (typeof phone === 'string') userUpdate.phone = phone.trim() || null;

    let sellerProfile = null;

    if (req.user.role === 'SELLER') {
      const sellerUpdate = {};
      if (typeof whatsapp === 'string') sellerUpdate.whatsapp = whatsapp.trim() || null;
      if (typeof location === 'string') sellerUpdate.location = location.trim() || null;
      if (['PRIVATE', 'DEALER', 'COMPANY'].includes(sellerType)) sellerUpdate.sellerType = sellerType;

      if (Object.keys(sellerUpdate).length > 0) {
        sellerProfile = await prisma.sellerProfile.update({
          where: { userId },
          data: sellerUpdate,
        });
      } else {
        sellerProfile = await prisma.sellerProfile.findUnique({ where: { userId } });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: userUpdate,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        sellerProfile: req.user.role === 'SELLER' ? true : false,
      },
    });

    res.json({ user: updatedUser, sellerProfile });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error updating profile' });
  }
};

module.exports = {
  register,
  login,
  googleLogin,
  getMe,
  upgradeToSeller,
  forgotPassword,
  resetPassword,
  resetPasswordPage,
  verifyEmail,
  resendVerification,
  changePassword,
  logout,
  updateProfile
};
