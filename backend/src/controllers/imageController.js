const crypto = require('crypto');
const prisma = require('../config/db');

// Images are stored in the DB in several legacy formats. List APIs no longer
// ship the raw data; the browser loads each image from here once and then
// serves it from cache for a year (rows are never mutated; edits create new
// rows, so id-keyed immutable caching is safe).
const BASE64_URI_RE = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]*)$/i;
const SVG_URI_RE = /^data:image\/svg\+xml;utf8,([\s\S]+)$/i;

const sendWithCaching = (req, res, buffer, contentType, extraHeaders = {}) => {
  const etag = `"${crypto.createHash('md5').update(buffer).digest('hex')}"`;
  res.set('Content-Type', contentType);
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.set('ETag', etag);
  res.set('Content-Length', buffer.length);
  for (const [key, value] of Object.entries(extraHeaders)) {
    res.set(key, value);
  }
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }
  res.send(buffer);
};

// @desc    Serve a vehicle image with immutable caching
// @route   GET /api/images/:id
// @access  Public
const getImage = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid image id' });
    }

    const image = await prisma.vehicleImage.findUnique({
      where: { id },
      select: { data: true },
    });
    if (!image || !image.data) {
      return res.status(404).json({ message: 'Image not found' });
    }
    const data = image.data;

    // Base64 data URI -> raw bytes
    const base64Match = BASE64_URI_RE.exec(data);
    if (base64Match) {
      return sendWithCaching(req, res, Buffer.from(base64Match[2], 'base64'), base64Match[1]);
    }

    // Inline utf8 SVG -> serve the markup, sandboxed. SVG can carry <script>,
    // so CSP sandbox + nosniff keep it inert in browsers (legacy seeded data).
    const svgMatch = SVG_URI_RE.exec(data);
    if (svgMatch) {
      return sendWithCaching(
        req,
        res,
        Buffer.from(svgMatch[1], 'utf8'),
        'image/svg+xml',
        {
          'Content-Security-Policy': 'sandbox',
          'X-Content-Type-Options': 'nosniff',
        }
      );
    }

    // File on disk under /uploads -> hand off to the static route (relative
    // redirect only; never bounce to an attacker-controlled absolute URL).
    if (data.startsWith('/uploads/') || data.startsWith('uploads/')) {
      return res.redirect(301, data.startsWith('/') ? data : `/${data}`);
    }

    // External URL -> only redirect to a host we explicitly trust.
    if (data.startsWith('http://') || data.startsWith('https://')) {
      try {
        const host = new URL(data).hostname;
        const trustedHosts = (process.env.EXTERNAL_IMAGE_HOSTS || 'images.unsplash.com,res.cloudinary.com')
          .split(',')
          .map((h) => h.trim().toLowerCase())
          .filter(Boolean);
        if (trustedHosts.includes(host)) {
          return res.redirect(301, data);
        }
      } catch {
        // malformed URL falls through to 404
      }
    }

    return res.status(404).json({ message: 'Image data in unknown format' });
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).json({ message: 'Server error serving image' });
  }
};

module.exports = { getImage };
