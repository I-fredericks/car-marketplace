const express = require('express');
const multer = require('multer');
const path = require('path');
const { protect, seller } = require('../middlewares/authMiddleware');

const router = express.Router();

// Multer Config
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename(req, file, cb) {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

function checkFileType(file, cb) {
  const filetypes = /jpg|jpeg|png|webp/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb('Images only!');
  }
}

const upload = multer({
  storage,
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  },
});

// @desc    Upload multiple vehicle photos
// @route   POST /api/upload
// @access  Private (Seller only)
router.post('/', protect, seller, upload.array('images', 15), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: 'No files uploaded' });
  }

  // Construct URLs to return to the frontend
  const filePaths = req.files.map(file => `/${file.path.replace(/\\/g, '/')}`);

  res.send({
    message: 'Images Uploaded',
    urls: filePaths,
  });
});

module.exports = router;
