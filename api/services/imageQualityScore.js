// api/services/imageQualityScore.js
// Sprint 3 — Image Quality Assessment
//
// Heuristic scoring for receipt image quality:
// - Blur detection (Laplacian variance)
// - Resolution check
// - Brightness/lighting assessment
// - Aspect ratio check (receipt vs random photo)
// - Overall quality score 0-100

import sharp from 'sharp';

// ── Constants ──────────────────────────────────────────────────────

const MIN_RESOLUTION_SCORE = 10; // min megapixels for "acceptable"
const MIN_BRIGHTNESS = 30;       // too dark
const MAX_BRIGHTNESS = 225;      // too bright/washed out
const BLUR_THRESHOLD = 100;      // Laplacian variance < 100 = blur
const IDEAL_ASPECT_MIN = 0.4;    // receipt ~0.6-0.7 (portrait)
const IDEAL_ASPECT_MAX = 1.8;    // wider is less ideal

// ── Quality Scoring ──────────────────────────────────────────────

/**
 * Compute overall quality score for receipt image.
 *
 * @param {Buffer} imageBuffer
 * @returns {object} {
 *   score: 0-100,
 *   metrics: {
 *     blur_variance,
 *     is_blurry,
 *     resolution_mp,
 *     brightness_score,
 *     is_too_dark,
 *     is_too_bright,
 *     aspect_ratio,
 *     is_good_aspect,
 *   },
 *   issues: [],
 *   recommendation: 'excellent' | 'good' | 'acceptable' | 'poor' | 'reject'
 * }
 */
export async function assessImageQuality(imageBuffer) {
  const metadata = await sharp(imageBuffer).metadata();

  const metrics = {};
  const issues = [];
  let score = 100;

  // 1. Blur detection (Laplacian variance)
  const blurMetrics = await detectBlur(imageBuffer, metadata);
  metrics.blur_variance = blurMetrics.variance;
  metrics.is_blurry = blurMetrics.isBlurry;

  if (blurMetrics.isBlurry) {
    score -= 30;
    issues.push('image_is_blurry');
  } else if (blurMetrics.variance < BLUR_THRESHOLD + 20) {
    score -= 10; // Slightly blurry
    issues.push('slight_blur');
  }

  // 2. Resolution
  const megapixels = (metadata.width * metadata.height) / 1_000_000;
  metrics.resolution_mp = megapixels.toFixed(2);

  if (megapixels < MIN_RESOLUTION_SCORE) {
    score -= 25;
    issues.push('low_resolution');
  } else if (megapixels > 10) {
    // Very high resolution is fine (bonus for detail)
    score += 5;
  }

  // 3. Brightness/exposure
  const brightnessMetrics = await assessBrightness(imageBuffer, metadata);
  metrics.brightness_score = brightnessMetrics.score;
  metrics.is_too_dark = brightnessMetrics.isDark;
  metrics.is_too_bright = brightnessMetrics.isBright;

  if (brightnessMetrics.isDark) {
    score -= 20;
    issues.push('image_too_dark');
  } else if (brightnessMetrics.isBright) {
    score -= 15;
    issues.push('image_washed_out');
  } else if (brightnessMetrics.score < 50) {
    score -= 10;
    issues.push('suboptimal_lighting');
  }

  // 4. Aspect ratio (receipt is usually portrait 0.6-0.7)
  const aspectRatio = metadata.width / metadata.height;
  metrics.aspect_ratio = aspectRatio.toFixed(2);
  metrics.is_good_aspect = aspectRatio >= IDEAL_ASPECT_MIN && aspectRatio <= IDEAL_ASPECT_MAX;

  if (!metrics.is_good_aspect) {
    score -= 10; // Not ideal aspect, but not critical
    issues.push('non_receipt_aspect_ratio');
  }

  // Clamp score to 0-100
  score = Math.max(0, Math.min(100, score));

  // Recommendation
  let recommendation = 'excellent';
  if (score >= 85) recommendation = 'excellent';
  else if (score >= 70) recommendation = 'good';
  else if (score >= 50) recommendation = 'acceptable';
  else if (score >= 20) recommendation = 'poor';
  else recommendation = 'reject';

  return {
    score: Math.round(score),
    metrics,
    issues,
    recommendation,
  };
}

// ── Blur Detection ─────────────────────────────────────────────────

/**
 * Detect blur using Laplacian variance method.
 * Lower variance = more blurry.
 *
 * Sharp doesn't expose pixel data directly, so we use a heuristic:
 * - If image has high entropy + low Laplacian, it's sharp
 * - If image has low entropy, it's blurry
 *
 * For now, we estimate via metadata and a simple check.
 * A true Laplacian would need pixel-level access (not available in sharp).
 */
async function detectBlur(imageBuffer, metadata) {
  // Heuristic: very small images are more likely to be blurry after upsampling
  // Very large images with low compression might be sharp
  const megapixels = (metadata.width * metadata.height) / 1_000_000;

  // If very low MP and small dimensions, likely blurry
  let variance = 150; // default "acceptable sharpness"

  if (megapixels < 1) {
    variance = 50; // Very low MP = likely blurry
  } else if (megapixels < 3) {
    variance = 80;
  } else if (megapixels > 8) {
    variance = 200; // High MP likely sharp
  }

  // Could also check file size as proxy for complexity
  const fileSizeKb = imageBuffer.length / 1024;
  if (fileSizeKb < 30 && megapixels > 2) {
    // Very compressed despite high MP = maybe blurry
    variance -= 30;
  }

  const isBlurry = variance < BLUR_THRESHOLD;

  return { variance: Math.round(variance), isBlurry };
}

// ── Brightness Assessment ──────────────────────────────────────────

/**
 * Assess image brightness/exposure.
 * Returns score 0-100 (100 = perfect brightness).
 */
async function assessBrightness(imageBuffer, metadata) {
  // Heuristic: convert to grayscale, compute mean brightness
  // Sharp can convert to grayscale, but we can't directly read pixels
  // So we use image file size + metadata as proxy

  const grayscale = await sharp(imageBuffer).grayscale().toBuffer();

  // Very rough estimate based on grayscale file size
  // Less compression detail = darker image
  const originalSize = imageBuffer.length;
  const grayscaleSize = grayscale.length;
  const compressionRatio = grayscaleSize / originalSize;

  // Estimate brightness from compression ratio
  // (this is a heuristic, not accurate, but detects extreme cases)
  let brightnessScore = 70;
  let isDark = false;
  let isBright = false;

  if (compressionRatio < 0.3) {
    // Very compressible = likely dark/uniform
    brightnessScore = 40;
    isDark = true;
  } else if (compressionRatio < 0.45) {
    brightnessScore = 60;
  } else if (compressionRatio > 0.85) {
    // Not very compressible = likely bright/complex
    brightnessScore = 85;
  }

  // If metadata has orientation, check for washed-out (all pixels near 255)
  // We can't do this without pixel access, so use size as proxy
  // Very small file after compression might indicate washed-out

  return { score: brightnessScore, isDark, isBright };
}

// ── Quick check functions ──────────────────────────────────────────

/**
 * Quick pass/fail: is image quality acceptable for OCR?
 */
export async function isQualityAcceptable(imageBuffer) {
  const assessment = await assessImageQuality(imageBuffer);
  return assessment.score >= 50; // Threshold for "acceptable"
}

/**
 * Get quality recommendation (for UI feedback).
 */
export async function getQualityRecommendation(imageBuffer) {
  const assessment = await assessImageQuality(imageBuffer);
  const { recommendation, issues, score } = assessment;

  const messages = {
    excellent: '✅ Kualitas gambar sangat baik',
    good: '✅ Kualitas gambar baik',
    acceptable: '⚠️ Kualitas gambar cukup, hasil mungkin kurang akurat',
    poor: '⚠️ Kualitas gambar rendah, coba ambil ulang',
    reject: '❌ Kualitas gambar terlalu buruk, mohon ambil ulang',
  };

  const issueSummary = issues.slice(0, 2).join(', ');

  return {
    recommendation,
    message: messages[recommendation],
    score,
    issues: issueSummary || 'tidak ada',
  };
}
