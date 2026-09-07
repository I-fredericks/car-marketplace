// Image storage: S3-compatible object storage when configured, local disk
// otherwise. Generates a WebP thumbnail alongside every raster original so
// list views never download full-size photos.
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
 * Persist an uploaded file (and a thumbnail when raster) to the configured
 * backend. Returns { url, thumbUrl } — thumbUrl is null for PDFs.
 */
const saveUpload = async (buffer, originalName, mimetype) => {
  const ext = (path.extname(originalName) || '').toLowerCase() || `.${String(mimetype).split('/')[1] || 'bin'}`;
  const isRaster = /image\/(jpe?g|png|webp|heic|heif|tiff?|avif)/i.test(mimetype || '') ||
                   /\.(jpe?g|png|webp|heic|heif|tiff?|avif)$/i.test(ext);

  if (isCloudEnabled()) {
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
