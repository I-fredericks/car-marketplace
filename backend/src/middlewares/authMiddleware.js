const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token (index.js hard-fails at boot if JWT_SECRET is missing)
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
        },
      });

      // Token is valid but the account is gone or deactivated: refuse.
      // (req.user is reloaded from the DB on every request, so a deactivation
      // takes effect immediately without waiting for the 7-day JWT to expire.)
      if (!user) {
        return res.status(401).json({ message: 'Not authorized' });
      }
      if (!user.isActive) {
        return res.status(401).json({
          message: 'This account has been deactivated.',
          deactivated: true,
        });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'ADMIN') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};

const seller = (req, res, next) => {
  if (req.user && (req.user.role === 'SELLER' || req.user.role === 'ADMIN')) {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized. Seller account required.' });
  }
};

// Attaches req.user when a valid Bearer token is present; anonymous requests
// pass through untouched. For public endpoints with owner-only extras.
const optionalAuth = async (req, res, next) => {
  if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
    return next();
  }
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    // Deactivated accounts get the anonymous view, never owner-only extras.
    if (user && user.isActive) req.user = user;
  } catch (_) {
    // Invalid/expired token on a public route: treat as anonymous
  }
  next();
};

module.exports = { protect, admin, seller, optionalAuth };
