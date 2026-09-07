// Image storage, in priority order:
//   1. S3-compatible object storage when S3_* env vars are set
//   2. Base64 data URIs stored in the image row itself ("db" mode) — used on
//      hosts with an ephemeral filesystem (Render redeploys wipe /uploads).
//      imageController already decodes data URIs, so nothing else changes
//   3. Local disk for development
// Force a mode with STORAGE_DRIVER=db|disk|s3. Render sets RENDER=true, which
// flips an otherwise disk-configured deploy to db mode automatically.
//
// S3 env vars (all required together to enable cloud mode):
//   S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
//   S3_ENDPOINT      - optional, for R2/Spaces/MinIO (AWS itself omits it)
//   S3_PUBLIC_URL    - optional, public base URL (CDN/custom domain);
//                      defaults to the endpoint/bucket URL
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const isCloudEnabled = () =>
  Boolean(process.env.S3_BUCKET && process.env.S3_REGION &&
          process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);

const driver = () => {
  const forced = (process.env.STORAGE_DRIVER || '').toLowerCase();
  if (forced === 'db' || forced === 'disk' || forced === 's3') return forced;
  if (isCloudEnabled()) return 's3';
  // Ephemeral hosts: disk uploads vanish on the next boot, so store in the DB.
  if (process.env.RENDER === 'true') return 'db';
  return 'disk';
};

let s3Client = null;
const getS3 = () => {
  if (!s3Client) {
    const { S3Client } = require('@aws-sdk/client-s3');
    s3Client = new S3Client({
      region: process.env.S3_REGION,
      ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
};

const publicBaseUrl = () => {
  if (process.env.S3_PUBLIC_URL) return process.env.S3_PUBLIC_URL.replace(/\/$/, '');
  if (process.env.S3_ENDPOINT) {
    return `${process.env.S3_ENDPOINT.replace(/\/$/, '')}/${process.env.S3_BUCKET}`;
  }
  return `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com`;
};

// 800px WebP thumbnail (retina-friendly for card + gallery use; was 480/72
// and looked soft on modern hi-DPI screens). Returns null for formats sharp
// can't decode (e.g. PDF) so callers skip thumbnailing documents.
const THUMB_WIDTH = 800;
const makeThumbBuffer = async (buffer) => {
  try {
    return await sharp(buffer)
      .rotate() // respect EXIF orientation
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return null;
  }
};

const randomName = (ext) => `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;

const uploadsDir = path.resolve(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Thumbnail path convention shared by the disk writer and the thumb route:
// original.ext -> original_thumb.webp
const diskThumbName = (filename) => {
  const ext = path.extname(filename);
  return `${path.basename(filename, ext)}_thumb.webp`;
};

/**
 * Persist an uploaded file to the configured backend (db | s3 | disk).
 * Returns { url, thumbUrl } — thumbUrl is null for PDFs and for db mode
 * (thumbs are resized on the fly when the image is served).
 */
const saveUpload = async (buffer, originalName, mimetype) => {
  const ext = (path.extname(originalName) || '').toLowerCase() || `.${String(mimetype).split('/')[1] || 'bin'}`;
  const isRaster = /image\/(jpe?g|png|webp|heic|heif|tiff?|avif)/i.test(mimetype || '') ||
                   /\.(jpe?g|png|webp|heic|heif|tiff?|avif)$/i.test(ext);

  // DB mode: the bytes live in the image row as a data URI — survives hosts
  // with an ephemeral filesystem (Render). Rassters are normalized to WebP
  // first so a 12MB phone photo shrinks to a few hundred KB of base64. The
  // image routes decode these on the fly (thumbs resized on demand), so no
  // other code path changes.
  if (driver() === 'db') {
    if (isRaster) {
      const normalized = await sharp(buffer).rotate().webp({ quality: 80 }).toBuffer();
      return { url: `data:image/webp;base64,${normalized.toString('base64')}`, thumbUrl: null };
    }
    return {
      url: `data:${mimetype || 'application/octet-stream'};base64,${buffer.toString('base64')}`,
      thumbUrl: null,
    };
  }

  if (driver() === 's3') {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    const base = randomName(isRaster ? '.webp' : ext);
    const key = `uploads/${base}`;
    const put = (k, body, contentType) =>
      getS3().send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: k,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
        ACL: 'public-read',
      }));

    if (isRaster) {
      // Normalize originals to WebP as well: phones upload 5-15MB HEIC/JPEGs
      const normalized = await sharp(buffer).rotate().webp({ quality: 82 }).toBuffer();
      const thumb = await makeThumbBuffer(normalized);
      const thumbKey = `uploads/${path.basename(base, '.webp')}_thumb.webp`;
      await Promise.all([
        put(key, normalized, 'image/webp'),
        ...(thumb ? [put(thumbKey, thumb, 'image/webp')] : []),
      ]);
      return {
        url: `${publicBaseUrl()}/${key}`,
        thumbUrl: thumb ? `${publicBaseUrl()}/${thumbKey}` : null,
      };
    }

    await put(key, buffer, mimetype || 'application/octet-stream');
    return { url: `${publicBaseUrl()}/${key}`, thumbUrl: null };
  }

  // Disk fallback
  const filename = randomName(ext);
  const original = path.join(uploadsDir, filename);
  fs.writeFileSync(original, buffer);

  let thumbUrl = null;
  if (isRaster) {
    const thumb = await makeThumbBuffer(buffer);
    if (thumb) {
      const thumbName = diskThumbName(filename);
      fs.writeFileSync(path.join(uploadsDir, thumbName), thumb);
      thumbUrl = `/uploads/${thumbName}`;
    }
  }
  return { url: `/uploads/${filename}`, thumbUrl };
};

module.exports = {
  saveUpload,
  makeThumbBuffer,
  isCloudEnabled,
  diskThumbName,
  uploadsDir,
  THUMB_WIDTH,
};
