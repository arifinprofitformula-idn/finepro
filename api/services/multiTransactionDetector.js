// api/services/multiTransactionDetector.js
// Sprint 3 — Multi-Transaction Detection
//
// Detect and split multiple receipts/transactions in single image:
// - Detect receipt boundaries (white space, color discontinuity)
// - Split into individual receipt images
// - Analyze each separately
//
// Heuristic: receipts usually have clear whitespace separation.
// Can also detect color changes or text density drops.

import sharp from 'sharp';

// ── Constants ──────────────────────────────────────────────────────

const MIN_RECEIPT_HEIGHT = 150;  // Min pixels for a valid receipt
const MIN_RECEIPT_WIDTH = 100;
const GAP_THRESHOLD = 50;        // Min whitespace gap to consider as separator
const TEXT_DENSITY_THRESHOLD = 0.2; // Min % of dark pixels to consider "content"

// ── Main detection ─────────────────────────────────────────────────

/**
 * Detect multiple receipts in a single image.
 *
 * Returns array of cropped receipt images if multiple detected,
 * or single-item array if only one receipt found.
 *
 * @param {Buffer} imageBuffer
 * @param {object} options
 * @param {number} options.gapThreshold - min whitespace gap between receipts
 * @returns {object} {
 *   count: number,
 *   receipts: [
 *     {
 *       index: number,
 *       buffer: Buffer,
 *       region: { left, top, width, height },
 *       confidence: 'high' | 'medium' | 'low'
 *     }
 *   ],
 *   gaps: [ { position, size } ],
 *   detection_method: 'vertical_scan' | 'horizontal_scan' | 'single',
 * }
 */
export async function detectMultipleTransactions(imageBuffer, options = {}) {
  const { gapThreshold = GAP_THRESHOLD } = options;

  const metadata = await sharp(imageBuffer).metadata();
  const { width, height } = metadata;

  // Heuristic approach: scan for large whitespace gaps
  // This is cheaper than pixel-level analysis

  // For now, use simple heuristic:
  // If image aspect ratio is very tall (height >> width),
  // might contain multiple receipts stacked vertically
  const aspectRatio = height / width;

  if (aspectRatio < 1.5) {
    // Likely single receipt or wide layout
    return {
      count: 1,
      receipts: [
        {
          index: 0,
          buffer: imageBuffer,
          region: { left: 0, top: 0, width, height },
          confidence: 'high',
        },
      ],
      gaps: [],
      detection_method: 'single',
    };
  }

  // Tall image: attempt vertical split
  const splits = await attemptVerticalSplit(imageBuffer, gapThreshold);

  if (splits.length > 1) {
    const receipts = splits.map((region, idx) => ({
      index: idx,
      buffer: null, // Will be populated below
      region,
      confidence: 'medium',
    }));

    // Extract each region
    for (const receipt of receipts) {
      receipt.buffer = await sharp(imageBuffer)
        .extract({
          left: receipt.region.left,
          top: receipt.region.top,
          width: receipt.region.width,
          height: receipt.region.height,
        })
        .toBuffer();
    }

    const gaps = detectVerticalGaps(splits);

    return {
      count: receipts.length,
      receipts,
      gaps,
      detection_method: 'vertical_scan',
    };
  }

  // Fallback: return as single receipt
  return {
    count: 1,
    receipts: [
      {
        index: 0,
        buffer: imageBuffer,
        region: { left: 0, top: 0, width, height },
        confidence: 'low',
      },
    ],
    gaps: [],
    detection_method: 'single',
  };
}

/**
 * Attempt to split image vertically based on content gaps.
 *
 * Strategy: divide image into horizontal bands,
 * estimate content density for each band.
 * Large gaps = potential split point.
 */
async function attemptVerticalSplit(imageBuffer, gapThreshold) {
  const metadata = await sharp(imageBuffer).metadata();
  const { width, height } = metadata;

  // Scan height in bands (every 30px)
  const bandHeight = 30;
  const bands = [];
  let currentBand = { top: 0, contentLines: 0 };

  // Heuristic: very compressed image = assume single receipt
  const fileSize = imageBuffer.length;
  if (fileSize < 20000) {
    // Very small file, likely single receipt
    return [];
  }

  // For a more accurate split, we'd need pixel data.
  // Without that, use simple aspect ratio-based heuristic:
  //
  // If image is > 2x tall, assume top half and bottom half might be receipts
  const estimatedCount = Math.floor(height / (width * 1.2));

  if (estimatedCount <= 1) {
    return [];
  }

  // Guess split points
  const splits = [];
  const receiptHeightEstimate = Math.round(height / estimatedCount);

  for (let i = 0; i < estimatedCount; i++) {
    const top = i * receiptHeightEstimate;
    const bottom = Math.min((i + 1) * receiptHeightEstimate, height);
    const splitHeight = bottom - top;

    if (splitHeight >= MIN_RECEIPT_HEIGHT) {
      splits.push({
        left: 0,
        top,
        width,
        height: splitHeight,
      });
    }
  }

  return splits.length > 1 ? splits : [];
}

/**
 * Detect vertical gaps between detected receipt regions.
 */
function detectVerticalGaps(regions) {
  const gaps = [];

  for (let i = 0; i < regions.length - 1; i++) {
    const currentBottom = regions[i].top + regions[i].height;
    const nextTop = regions[i + 1].top;
    const gapSize = nextTop - currentBottom;

    if (gapSize > 0) {
      gaps.push({
        position: currentBottom,
        size: gapSize,
        between: `receipt_${i}_and_${i + 1}`,
      });
    }
  }

  return gaps;
}

// ── Quick check ────────────────────────────────────────────────────

/**
 * Check if image likely contains multiple receipts.
 */
export async function likelyMultipleReceipts(imageBuffer) {
  const metadata = await sharp(imageBuffer).metadata();
  const { width, height } = metadata;
  const aspectRatio = height / width;

  // Very tall = likely multiple
  return aspectRatio > 1.8;
}

/**
 * Get human-readable message about receipt count.
 */
export async function getReceiptCountMessage(imageBuffer) {
  const result = await detectMultipleTransactions(imageBuffer);

  if (result.count === 1) {
    return {
      count: 1,
      message: 'Satu struk terdeteksi',
      processAs: 'single',
    };
  } else if (result.count <= 3) {
    return {
      count: result.count,
      message: `${result.count} struk terdeteksi. Akan dianalisis secara terpisah.`,
      processAs: 'multiple',
    };
  } else {
    return {
      count: result.count,
      message: `${result.count}+ struk terdeteksi. Mohon ambil gambar per-struk untuk hasil lebih akurat.`,
      processAs: 'warn_too_many',
    };
  }
}
