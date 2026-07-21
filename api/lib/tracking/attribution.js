// api/lib/tracking/attribution.js
// First-touch / last-touch UTM attribution, first-party. First-touch tidak
// pernah ditimpa; last-touch diperbarui setiap kali campaign parameter baru
// (utm_source atau click id) ditemukan. Data disimpan per anonymous_id (cookie
// first-party dari browser), lalu ditautkan ke user_id setelah registrasi.

import pool from '../../db.js';

const MAX_FIELD_LENGTH = 200;
const CONTROL_CHARS_PATTERN = new RegExp('[\\u0000-\\u001F\\u007F]', 'g');

function sanitizeField(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  if (!str) return null;
  // Buang karakter kontrol dan batasi panjang -- mencegah query-string sampah/berbahaya tersimpan.
  const cleaned = str.replace(CONTROL_CHARS_PATTERN, '');
  return cleaned.slice(0, MAX_FIELD_LENGTH) || null;
}

function sanitizeTouch(touch = {}) {
  return {
    utm_source: sanitizeField(touch.utm_source),
    utm_medium: sanitizeField(touch.utm_medium),
    utm_campaign: sanitizeField(touch.utm_campaign),
    utm_content: sanitizeField(touch.utm_content),
    utm_term: sanitizeField(touch.utm_term),
    landing_path: sanitizeField(touch.landing_path),
    referrer: sanitizeField(touch.referrer),
    fbclid: sanitizeField(touch.fbclid),
    gclid: sanitizeField(touch.gclid),
  };
}

function hasCampaignSignal(touch) {
  return Boolean(touch.utm_source || touch.utm_campaign || touch.fbclid || touch.gclid);
}

// captureTouch(anonymousId, touch) -> upsert first-touch (kalau belum ada) + last-touch (kalau ada sinyal campaign baru).
export async function captureTouch(anonymousId, rawTouch) {
  const id = sanitizeField(anonymousId);
  if (!id) return null;
  const touch = sanitizeTouch(rawTouch);
  if (!hasCampaignSignal(touch) && !touch.landing_path) return null;

  const existing = await pool.query('SELECT id, first_captured_at FROM acquisition_attribution WHERE anonymous_id = $1', [id]);

  if (existing.rows.length === 0) {
    await pool.query(
      `INSERT INTO acquisition_attribution (
         anonymous_id,
         first_utm_source, first_utm_medium, first_utm_campaign, first_utm_content, first_utm_term,
         first_landing_path, first_referrer, first_fbclid, first_gclid, first_captured_at,
         last_utm_source, last_utm_medium, last_utm_campaign, last_utm_content, last_utm_term,
         last_landing_path, last_referrer, last_fbclid, last_gclid, last_captured_at
       ) VALUES ($1, $2,$3,$4,$5,$6,$7,$8,$9,$10, now(), $2,$3,$4,$5,$6,$7,$8,$9,$10, now())`,
      [
        id,
        touch.utm_source, touch.utm_medium, touch.utm_campaign, touch.utm_content, touch.utm_term,
        touch.landing_path, touch.referrer, touch.fbclid, touch.gclid,
      ]
    );
    return;
  }

  // First-touch tidak pernah ditimpa. Last-touch hanya diperbarui kalau ada sinyal campaign baru.
  if (hasCampaignSignal(touch)) {
    await pool.query(
      `UPDATE acquisition_attribution SET
         last_utm_source = $2, last_utm_medium = $3, last_utm_campaign = $4, last_utm_content = $5, last_utm_term = $6,
         last_landing_path = $7, last_referrer = $8, last_fbclid = $9, last_gclid = $10,
         last_captured_at = now(), updated_at = now()
       WHERE anonymous_id = $1`,
      [id, touch.utm_source, touch.utm_medium, touch.utm_campaign, touch.utm_content, touch.utm_term, touch.landing_path, touch.referrer, touch.fbclid, touch.gclid]
    );
  }
}

// linkToUser(anonymousId, userId) -> dipanggil setelah registrasi sukses agar attribution anonymous tertaut ke user.
export async function linkToUser(anonymousId, userId) {
  const id = sanitizeField(anonymousId);
  if (!id || !userId) return;
  await pool.query(
    `UPDATE acquisition_attribution SET user_id = $2, updated_at = now() WHERE anonymous_id = $1`,
    [id, userId]
  );
}

export async function getByAnonymousId(anonymousId) {
  const id = sanitizeField(anonymousId);
  if (!id) return null;
  const result = await pool.query('SELECT * FROM acquisition_attribution WHERE anonymous_id = $1', [id]);
  return result.rows[0] || null;
}

export async function getByUserId(userId) {
  if (!userId) return null;
  const result = await pool.query('SELECT * FROM acquisition_attribution WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1', [userId]);
  return result.rows[0] || null;
}

export async function cleanupExpiredAttribution(retentionDays = 180) {
  const result = await pool.query(
    `DELETE FROM acquisition_attribution WHERE user_id IS NULL AND created_at < now() - ($1 || ' days')::interval`,
    [Number(retentionDays) || 180]
  );
  return result.rowCount;
}
