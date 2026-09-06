const multer = require('multer');
const path = require('path');
const prisma = require('../config/db');
const { saveUpload } = require('../services/storage');

// Profile photos: single image, raster only (profile photos are never PDFs).
// Memory storage: the storage service persists it to S3 or disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB is plenty for a profile photo
  fileFilter: (req, file, cb) => {
    const ALLOWED_TYPES = /jpg|jpeg|png|webp|heic|heif/;
    const extname = ALLOWED_TYPES.test(path.extname(file.originalname || '').toLowerCase());
    const mimetype = ALLOWED_TYPES.test(file.mimetype || '');
    cb(null, extname || mimetype);
  },
});

// Multer middleware exported so the route can surface friendly errors.
const avatarUpload = (req, res, next) => {
  upload.single('avatar')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'The photo must be under 8MB.'
        : `Upload failed: ${err.message || 'please try again.'}`;
      return res.status(400).json({ message });
    }
    next();
  });
};

// @desc    Upload a profile photo (goes to admin review)
// @route   POST /api/users/avatar
// @access  Private
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No photo uploaded. Use JPG, PNG, WEBP or HEIC.' });
    }

    const { url } = await saveUpload(req.file.buffer, req.file.originalname, req.file.mimetype);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { avatar: url, avatarStatus: 'PENDING', avatarRejectionReason: null },
    });

    res.json({
      message: 'Profile photo uploaded — it will appear once an admin approves it.',
      avatarStatus: 'PENDING',
    });
  } catch (error) {
    console.error('Error uploading avatar:', error);
    res.status(500).json({ message: 'Failed to store the uploaded photo' });
  }
};

// @desc    Serve a user's profile photo
// @route   GET /api/users/:id/avatar
// @access  Public (optionalAuth)
//
// Stored values reuse the VehicleImage.data conventions: /uploads paths and
// trusted absolute URLs redirect, base64 data URIs decode inline.
// Visibility: APPROVED photos are public so any surface can render them
// (navbar, chats, seller cards). PENDING/REJECTED photos are only served to
// their owner (own-profile preview) and admins (review) — never to others.
const getAvatar = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { avatar: true, avatarStatus: true },
    });
    if (!user || !user.avatar || user.avatarStatus === 'NONE') {
      return res.status(404).json({ message: 'No profile photo' });
    }

    // Moderation gate: unapproved photos are owner/admin-only. Anonymous and
    // other users get a 404, which clients treat as "render the fallback".
    if (user.avatarStatus !== 'APPROVED') {
      const isOwner = req.user && req.user.id === id;
      const isAdmin = req.user && req.user.role === 'ADMIN';
      if (!isOwner && !isAdmin) {
        return res.status(404).json({ message: 'No profile photo' });
      }
      // Previews must never be cached by shared caches.
      res.set('Cache-Control', 'private, max-age=60');
    } else {
      // Clients cache-bust with ?v=<updatedAt>, so a short TTL is enough here.
      res.set('Cache-Control', 'public, max-age=300');
    }
    const data = user.avatar;

    if (data.startsWith('/uploads/') || data.startsWith('uploads/')) {
      return res.redirect(301, data.startsWith('/') ? data : `/${data}`);
    }

    if (data.startsWith('http://') || data.startsWith('https://')) {
      try {
        const host = new URL(data).hostname;
        const trustedHosts = (process.env.EXTERNAL_IMAGE_HOSTS || 'images.unsplash.com,res.cloudinary.com')
          .split(',')
          .map((h) => h.trim().toLowerCase())
          .filter(Boolean);
        if (process.env.S3_PUBLIC_URL) {
          trustedHosts.push(new URL(process.env.S3_PUBLIC_URL).hostname.toLowerCase());
        }
        if (trustedHosts.includes(host)) {
          return res.redirect(301, data);
        }
      } catch {
        // malformed URL falls through to 404
      }
    }

    const base64Match = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]*)$/i.exec(data);
    if (base64Match) {
      res.set('Content-Type', base64Match[1].toLowerCase());
      return res.send(Buffer.from(base64Match[2], 'base64'));
    }

    return res.status(404).json({ message: 'Photo data in unknown format' });
  } catch (error) {
    console.error('Error serving avatar:', error);
    res.status(500).json({ message: 'Server error serving avatar' });
  }
};

module.exports = { avatarUpload, uploadAvatar, getAvatar };
