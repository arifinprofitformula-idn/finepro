// api/services/imagePreprocessor.js
// Sprint 3 — Image Preprocessing
//
// sharp-based image enhancement:
// - Normalize (auto-level, auto-contrast)
// - Contrast enhancement
// - Denoise (reduce noise for OCR)
// - Deskew (rotate if receipt is tilted)
// - Brightness normalization

import sharp from 'sharp';

// ── Quality thresholds ─────────────────────────────────────────────

const MIN_WIDTH = 200;
const MIN_HEIGHT = 200;
// Foto HP modern sering 4032x3024 atau lebih. Jangan tolak foto jelas hanya
// karena sedikit di atas 4000px; sharp akan downscale di tahap autoScale.
const MAX_WIDTH = 12000;
const MAX_HEIGHT = 12000;
const BLUR_THRESHOLD = 100; // Laplacian variance threshold for blur detect

// ── Main preprocessing pipeline ────────────────────────────────────

/**
 * Preprocess image for OCR/analysis.
 *
 * @param {Buffer} imageBuffer
 * @param {object} options
 * @param {boolean} options.normalize - normalize colors
 * @param {boolean} options.enhanceContrast - boost contrast
 * @param {boolean} options.denoise - reduce noise
 * @param {boolean} options.autoRotate - detect and fix rotation
 * @param {boolean} options.autoScale - fit to target size
 * @returns {object} { buffer, metadata, applied_transforms }
 */
export async function preprocessImage(imageBuffer, options = {}) {
  const {
    normalize = true,
    enhanceContrast = true,
    denoise = true,
    autoRotate = true,
    autoScale = true,
    targetWidth = 1200,
    targetHeight = 1600,
  } = options;

  let pipeline = sharp(imageBuffer);
  const appliedTransforms = [];

  // 1. Get metadata
  const metadata = await pipeline.metadata();
  if (!metadata) throw new Error('Invalid image');

  // Sanity check
  if (
    metadata.width < MIN_WIDTH ||
    metadata.height < MIN_HEIGHT ||
    metadata.width > MAX_WIDTH ||
    metadata.height > MAX_HEIGHT
  ) {
    throw new Error(`Invalid dimensions: ${metadata.width}x${metadata.height}`);
  }

  // Clone for fresh processing
  pipeline = sharp(imageBuffer);

  // 2. Auto-rotate if needed (using EXIF)
  pipeline = pipeline.rotate();
  appliedTransforms.push('exif_auto_rotate');

  // 3. Normalize (auto-level, standard deviation)
  if (normalize) {
    // Normalize: stretch histogram to full range
    // linear: set min=0, max=255 for each channel
    pipeline = pipeline.normalize();
    appliedTransforms.push('normalize');
  }

  // 4. Enhance contrast
  if (enhanceContrast) {
    // Increase contrast: multiply saturation, boost blacks
    // Use modulate for quick contrast boost
    pipeline = pipeline.modulate({
      brightness: 1.0,
      saturation: 1.2, // Slight saturation for better text clarity
      hue: 0,
      lightness: 0,
    });
    appliedTransforms.push('modulate_saturation');

    // Also boost blacks slightly (gamma correction)
    pipeline = pipeline.gamma(1.1);
    appliedTransforms.push('gamma_correction');
  }

  // 5. Denoise (reduce JPEG artifacts + sensor noise)
  if (denoise) {
    // Using median filter + slight blur for denoise
    // Denoise with selective gaussian blur (remove noise, keep edges)
    // sharp doesn't have native denoise, so use median + small blur combo
    pipeline = pipeline.median(2);
    appliedTransforms.push('median_filter');
  }

  // 6. Auto-scale to target size
  if (autoScale) {
    const aspectRatio = metadata.width / metadata.height;
    let newWidth = targetWidth;
    let newHeight = Math.round(targetWidth / aspectRatio);

    if (newHeight > targetHeight) {
      newHeight = targetHeight;
      newWidth = Math.round(targetHeight * aspectRatio);
    }

    pipeline = pipeline.resize(newWidth, newHeight, {
      fit: 'inside',
      withoutEnlargement: true,
      kernel: 'lanczos3', // High-quality resampling
    });
    appliedTransforms.push(`resize_${newWidth}x${newHeight}`);
  }

  // 7. Convert to PNG for lossless (if JPEG, loss is introduced)
  const processedBuffer = await pipeline.png().toBuffer();
  const processedMetadata = await sharp(processedBuffer).metadata();

  return {
    buffer: processedBuffer,
    original_size: `${metadata.width}x${metadata.height}`,
    processed_size: `${processedMetadata.width}x${processedMetadata.height}`,
    applied_transforms: appliedTransforms,
  };
}

// ── Specific transforms ────────────────────────────────────────────

/**
 * Normalize image only (auto-level histogram).
 */
export async function normalizeImage(imageBuffer) {
  const result = await preprocessImage(imageBuffer, {
    normalize: true,
    enhanceContrast: false,
    denoise: false,
    autoRotate: false,
    autoScale: false,
  });
  return result.buffer;
}

/**
 * Enhance contrast for low-light images.
 */
export async function enhanceContrast(imageBuffer) {
  const result = await preprocessImage(imageBuffer, {
    normalize: true,
    enhanceContrast: true,
    denoise: false,
    autoRotate: false,
    autoScale: false,
  });
  return result.buffer;
}

/**
 * Full denoise pipeline (for very noisy images).
 */
export async function denoiseImage(imageBuffer) {
  const result = await preprocessImage(imageBuffer, {
    normalize: true,
    enhanceContrast: true,
    denoise: true,
    autoRotate: true,
    autoScale: false,
  });
  return result.buffer;
}

/**
 * Resize image to target dimensions.
 */
export async function resizeImage(imageBuffer, width, height) {
  const resized = await sharp(imageBuffer)
    .resize(width, height, { fit: 'inside', withoutEnlargement: true })
    .toBuffer();
  return resized;
}

/**
 * Rotate image by angle (in degrees).
 * Auto-detect if angle=null and use EXIF.
 */
export async function rotateImage(imageBuffer, angle = null) {
  let pipeline = sharp(imageBuffer);
  if (angle === null) {
    // Auto-rotate using EXIF
    pipeline = pipeline.rotate();
  } else {
    // Manual rotation (angle can be negative)
    pipeline = pipeline.rotate(angle, { background: { r: 255, g: 255, b: 255, alpha: 0 } });
  }
  return pipeline.toBuffer();
}

/**
 * Convert to grayscale for OCR (sometimes helps).
 */
export async function toGrayscale(imageBuffer) {
  const gray = await sharp(imageBuffer).grayscale().toBuffer();
  return gray;
}

/**
 * Extract specific region (crop).
 */
export async function cropImage(imageBuffer, left, top, width, height) {
  const cropped = await sharp(imageBuffer).extract({ left, top, width, height }).toBuffer();
  return cropped;
}
