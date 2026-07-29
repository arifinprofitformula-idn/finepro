// api/services/documentCropper.js
// Sprint 3 — Document Auto-Crop
//
// Detect receipt boundaries and auto-crop using real pixel content, not fixed
// percentage margins. Fixed-margin crop was risky: clear WhatsApp/Telegram
// photos could lose total/date/merchant text near the edge and then fail OCR.

import sharp from 'sharp';

const MIN_CONTENT_WIDTH = 200;
const MIN_CONTENT_HEIGHT = 300;
const CROP_MARGIN_PX = 24;
const ANALYSIS_WIDTH = 480;
const DARK_PIXEL_THRESHOLD = 225; // grayscale value below this counts as content/text/edge
const MIN_DARK_PIXELS_PER_ROW_RATIO = 0.01;
const MIN_DARK_PIXELS_PER_COL_RATIO = 0.01;
const MIN_CROP_DELTA_RATIO = 0.04; // only crop if it removes meaningful border

/**
 * Auto-detect and crop receipt from image.
 *
 * Strategy:
 * 1. Resize a grayscale clone for fast analysis.
 * 2. Find rows/columns that contain enough non-white pixels.
 * 3. Map the bounding box back to original dimensions.
 * 4. Crop only when confidence is safe; otherwise preserve original image.
 */
export async function autoCropReceipt(imageBuffer, options = {}) {
  const { margin = CROP_MARGIN_PX, aggressiveCrop = false } = options;
  const image = sharp(imageBuffer).rotate();
  const metadata = await image.metadata();
  const { width, height } = metadata;

  if (!width || !height) {
    return noCrop(imageBuffer, 'unknown', 'none');
  }

  const boundary = await detectContentBoundary(imageBuffer, { width, height, aggressiveCrop });
  if (!boundary) {
    return noCrop(imageBuffer, `${width}x${height}`, 'none');
  }

  const cropMargin = aggressiveCrop ? Math.round(margin / 2) : margin;
  const left = Math.max(0, boundary.left - cropMargin);
  const top = Math.max(0, boundary.top - cropMargin);
  const right = Math.min(width, boundary.right + cropMargin);
  const bottom = Math.min(height, boundary.bottom + cropMargin);
  const cropWidth = right - left;
  const cropHeight = bottom - top;

  if (cropWidth < MIN_CONTENT_WIDTH || cropHeight < MIN_CONTENT_HEIGHT) {
    return noCrop(imageBuffer, `${width}x${height}`, 'low');
  }

  const removedRatio = 1 - ((cropWidth * cropHeight) / (width * height));
  if (removedRatio < MIN_CROP_DELTA_RATIO && !aggressiveCrop) {
    return noCrop(imageBuffer, `${width}x${height}`, 'low');
  }

  const cropped = await sharp(imageBuffer)
    .rotate()
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .png()
    .toBuffer();

  return {
    buffer: cropped,
    crop_region: { left, top, width: cropWidth, height: cropHeight },
    original_size: `${width}x${height}`,
    cropped_size: `${cropWidth}x${cropHeight}`,
    crop_applied: true,
    confidence: removedRatio > 0.15 ? 'high' : 'medium',
  };
}

function noCrop(buffer, size, confidence) {
  return {
    buffer,
    crop_region: null,
    original_size: size,
    cropped_size: size,
    crop_applied: false,
    confidence,
  };
}

async function detectContentBoundary(imageBuffer, { width, height, aggressiveCrop = false }) {
  const analysisWidth = Math.min(ANALYSIS_WIDTH, width);
  const analysisHeight = Math.max(1, Math.round((analysisWidth / width) * height));

  const { data, info } = await sharp(imageBuffer)
    .rotate()
    .resize(analysisWidth, analysisHeight, { fit: 'inside', withoutEnlargement: true })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rowThreshold = Math.max(2, Math.floor(info.width * (aggressiveCrop ? 0.006 : MIN_DARK_PIXELS_PER_ROW_RATIO)));
  const colThreshold = Math.max(2, Math.floor(info.height * (aggressiveCrop ? 0.006 : MIN_DARK_PIXELS_PER_COL_RATIO)));

  const darkRows = [];
  for (let y = 0; y < info.height; y += 1) {
    let count = 0;
    for (let x = 0; x < info.width; x += 1) {
      if (data[y * info.width + x] < DARK_PIXEL_THRESHOLD) count += 1;
    }
    if (count >= rowThreshold) darkRows.push(y);
  }

  const darkCols = [];
  for (let x = 0; x < info.width; x += 1) {
    let count = 0;
    for (let y = 0; y < info.height; y += 1) {
      if (data[y * info.width + x] < DARK_PIXEL_THRESHOLD) count += 1;
    }
    if (count >= colThreshold) darkCols.push(x);
  }

  if (darkRows.length < 5 || darkCols.length < 5) return null;

  const topSmall = percentile(darkRows, 0.01);
  const bottomSmall = percentile(darkRows, 0.99);
  const leftSmall = percentile(darkCols, 0.01);
  const rightSmall = percentile(darkCols, 0.99);

  const sx = width / info.width;
  const sy = height / info.height;

  return {
    left: Math.max(0, Math.floor(leftSmall * sx)),
    top: Math.max(0, Math.floor(topSmall * sy)),
    right: Math.min(width, Math.ceil((rightSmall + 1) * sx)),
    bottom: Math.min(height, Math.ceil((bottomSmall + 1) * sy)),
  };
}

function percentile(values, p) {
  if (!values.length) return 0;
  const index = Math.min(values.length - 1, Math.max(0, Math.floor(values.length * p)));
  return values[index];
}

export async function strictCrop(imageBuffer) {
  return autoCropReceipt(imageBuffer, { aggressiveCrop: true, margin: 10 });
}

export async function padImage(imageBuffer, paddingPx = 20, backgroundColor = '#ffffff') {
  const metadata = await sharp(imageBuffer).metadata();
  const { width, height } = metadata;

  const padded = await sharp(imageBuffer)
    .rotate()
    .extend({
      top: paddingPx,
      bottom: paddingPx,
      left: paddingPx,
      right: paddingPx,
      background: backgroundColor,
    })
    .png()
    .toBuffer();

  return {
    buffer: padded,
    original_size: `${width}x${height}`,
    padded_size: `${width + 2 * paddingPx}x${height + 2 * paddingPx}`,
  };
}
