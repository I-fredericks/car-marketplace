/**
 * Client-side image compression that preserves display quality.
 * - Never upscales; only downscales very large photos (max 1920px wide)
 * - Exports at high JPEG quality (0.85) so listings stay crisp
 * - Files already within limits pass through untouched (no quality loss)
 */

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.85;

export const MIN_RECOMMENDED_WIDTH = 800;

export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };
    img.src = url;
  });
}

/**
 * Returns { file, width, height, wasCompressed }.
 * Rejects files that are not real images.
 */
export async function compressImage(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error(`${file.name} is not an image`);
  }

  const img = await loadImage(file);
  const { width, height } = img;

  // Small-enough image: keep the original bytes untouched.
  if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
    return { file, width, height, wasCompressed: false };
  }

  const scale = MAX_DIMENSION / Math.max(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Compression failed'))),
      'image/jpeg',
      JPEG_QUALITY
    );
  });

  const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  const compressed = new File([blob], newName, { type: 'image/jpeg' });
  return { file: compressed, width, height, wasCompressed: true };
}
