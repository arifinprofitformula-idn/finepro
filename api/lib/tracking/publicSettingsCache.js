// api/lib/tracking/publicSettingsCache.js
// Cache in-memory sederhana untuk public tracking settings — dibaca oleh
// SETIAP page load (lewat GET /api/tracking/public-settings), jadi tidak
// boleh query DB setiap kali. TTL pendek sebagai fallback + invalidate
// eksplisit dipanggil setelah admin menyimpan pengaturan.

import { getRawSettings, toPublicSettings } from './settingsRepository.js';

const TTL_MS = 60 * 1000;
let cached = null;
let cachedAt = 0;

export async function getCachedPublicSettings() {
  const now = Date.now();
  if (cached && now - cachedAt < TTL_MS) {
    return cached;
  }
  const raw = await getRawSettings();
  cached = toPublicSettings(raw);
  cachedAt = now;
  return cached;
}

export function invalidatePublicSettingsCache() {
  cached = null;
  cachedAt = 0;
}
