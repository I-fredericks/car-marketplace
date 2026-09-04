const express = require('express');
const multer = require('multer');
const path = require('path');
const { protect, seller } = require('../middlewares/authMiddleware');
const { saveUpload } = require('../services/storage');

const router = express.Router();

// Memory storage: files are persisted by the storage service (S3 or disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max file size per image
  fileFilter: (req, file, cb) => {
    // Match on extension OR mimetype: phones frequently report generic
    // mimetypes (application/octet-stream) for gallery files, so requiring
    // both rejected perfectly good photos.
    const ALLOWED_TYPES = /jpg|jpeg|png|webp|heic|heif|pdf/;
    const extname = ALLOWED_TYPES.test(path.extname(file.originalname).toLowerCase());
    const mimetype = ALLOWED_TYPES.test(file.mimetype);

    if (extname || mimetype) {
      return cb(null, true);
    }
    // Skip the file but remember its name so the response can say what failed
    req.rejectedFiles = req.rejectedFiles || [];
    req.rejectedFiles.push(file.originalname);
    cb(null, false);
  },
});

router.post('/', protect, seller, (req, res) => {
  upload.array('images', 15)(req, res, async (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Each image must be under 15MB.'
        : `Upload failed: ${err.message || 'please try again.'}`;
      return res.status(400).json({ message });
    }

    const files = req.files || [];
    const rejected = req.rejectedFiles || [];

    if (files.length === 0) {
      return res.status(400).json({
        message: rejected.length
          ? `Unsupported file type: ${rejected.join(', ')}. Use JPG, PNG, WEBP, HEIC or PDF.`
          : 'No files uploaded',
      });
    }

    try {
      const results = await Promise.all(
        files.map((file) => saveUpload(file.buffer, file.originalname, file.mimetype))
      );

      res.send({
        message: 'Images Uploaded',
        urls: results.map((r) => r.url),
        thumbs: results.map((r) => r.thumbUrl),
        ...(rejected.length > 0 ? { rejected } : {}),
      });
    } catch (uploadErr) {
      console.error('Error persisting uploads:', uploadErr);
      res.status(500).json({ message: 'Failed to store uploaded files' });
    }
  });
});

module.exports = router;
