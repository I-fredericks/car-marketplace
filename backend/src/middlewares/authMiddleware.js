const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          passwordChangedAt: true,
        },
      });

      if (!user) {
        return res.status(401).json({ message: 'Not authorized' });
      }
      if (!user.isActive) {
        return res.status(401).json({
          message: 'This account has been deactivated.',
          deactivated: true,
        });
      }

      if (user.passwordChangedAt && decoded.iat) {
        const changedAtSec = Math.floor(user.passwordChangedAt.getTime() / 1000);
        if (decoded.iat < changedAtSec) {
          return res.status(401).json({
            message: 'Your password was changed. Please sign in again.',
            passwordChanged: true,
          });
        }
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

const PERMISSIONS = {
  ADMIN: ['*'],
  MANAGER: [
    'vehicles:read',
    'vehicles:write',
    'vehicles:moderate',
    'users:read',
    'users:write',
    'users:moderate',
    'reports:read',
    'reports:write',
    'avatars:read',
    'avatars:moderate',
    'broadcast:write',
    'stats:read',
  ],
  ACCOUNTANT: [
    'payments:read',
    'payments:write',
    'purchases:read',
    'purchases:write',
    'payouts:write',
    'disputes:read',
    'disputes:write',
    'stats:read',
    'stats:financial',
  ],
  STAFF: [
    'vehicles:read',
    'users:read',
    'reports:read',
    'stats:read',
  ],
};

const ROLE_PERMISSIONS = {
  ADMIN: PERMISSIONS.ADMIN,
  MANAGER: PERMISSIONS.MANAGER,
  ACCOUNTANT: PERMISSIONS.ACCOUNTANT,
  STAFF: PERMISSIONS.STAFF,
};

const hasPermission = (userRole, permission) => {
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.includes('*') || permissions.includes(permission);
};

const requirePermission = (permission) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized' });
  }
  if (hasPermission(req.user.role, permission)) {
    next();
  } else {
    res.status(403).json({ message: `Not authorized. Required permission: ${permission}` });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized' });
  }
  if (roles.includes(req.user.role)) {
    next();
  } else {
    res.status(403).json({ message: `Not authorized. Required role: ${roles.join(' or ')}` });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'ADMIN') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};

const manager = (req, res, next) => {
  if (req.user && (req.user.role === 'MANAGER' || req.user.role === 'ADMIN')) {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized. Manager role required.' });
  }
};

const accountant = (req, res, next) => {
  if (req.user && (req.user.role === 'ACCOUNTANT' || req.user.role === 'ADMIN')) {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized. Accountant role required.' });
  }
};

const seller = (req, res, next) => {
  if (req.user && (req.user.role === 'SELLER' || req.user.role === 'ADMIN')) {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized. Seller account required.' });
  }
};

const optionalAuth = async (req, res, next) => {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.split(' ')[1]
    : null;
  const cookieToken = req.cookies?.auth_token;
  const token = bearer || cookieToken || null;
  if (!token) {
    return next();
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    if (user && user.isActive) req.user = user;
  } catch (_) {
  }
  next();
};

module.exports = {
  protect,
  admin,
  manager,
  accountant,
  seller,
  optionalAuth,
  requirePermission,
  requireRole,
  hasPermission,
  ROLE_PERMISSIONS,
};