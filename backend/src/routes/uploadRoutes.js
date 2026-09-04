const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect, seller } = require('../middlewares/authMiddleware');

const router = express.Router();

const uploadsDir = path.resolve(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Disk storage for fast file uploads & tiny DB footprint
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Match on extension OR mimetype: phones frequently report generic mimetypes
// (application/octet-stream) for gallery files, so requiring both rejected
// perfectly good photos.
const ALLOWED_TYPES = /jpg|jpeg|png|webp|heic|heif|pdf/;

function checkFileType(req, file, cb) {
  const extname = ALLOWED_TYPES.test(path.extname(file.originalname).toLowerCase());
  const mimetype = ALLOWED_TYPES.test(file.mimetype);

  if (extname || mimetype) {
    return cb(null, true);
  }
  // Skip the file but remember its name so the response can say what failed
  // (a string passed to cb here used to surface as a generic "Server Error").
  req.rejectedFiles = req.rejectedFiles || [];
  req.rejectedFiles.push(file.originalname);
  cb(null, false);
}

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max file size per image
  fileFilter: checkFileType,
});

router.post('/', protect, seller, (req, res) => {
  upload.array('images', 15)(req, res, (err) => {
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

    const fileUrls = files.map(file => `/uploads/${file.filename}`);

    res.send({
      message: 'Images Uploaded',
      urls: fileUrls,
      ...(rejected.length > 0 ? { rejected } : {}),
    });
  });
});

module.exports = router;
