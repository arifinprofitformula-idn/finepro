// api/lib/tracking/normalize.js
// Normalisasi + hashing data user untuk Meta Conversions API (user_data.em/ph).
// Meta mewajibkan SHA-256 lowercase hex dari nilai yang sudah dinormalisasi.
// Hasil hash TIDAK dianggap PII oleh Meta, tapi tetap tidak pernah kita log/simpan.

import crypto from 'crypto';

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

// normalizeAndHashEmail(email) -> hash SHA-256 hex, atau null kalau input kosong/tidak valid.
export function normalizeAndHashEmail(email) {
  const trimmed = String(email || '').trim().toLowerCase();
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) return null;
  return sha256Hex(trimmed);
}

// normalizeAndHashPhone(phone) -> hash SHA-256 hex dari digit-only, atau null.
// Tidak menebak country code — hanya membuang simbol/spasi. Nomor yang sudah
// diawali "+" atau kode negara tetap dipakai apa adanya (digit-only).
export function normalizeAndHashPhone(phone) {
  const digitsOnly = String(phone || '').replace(/[^\d]/g, '');
  if (!digitsOnly || digitsOnly.length < 8) return null;
  return sha256Hex(digitsOnly);
}

export function hashExternalId(id) {
  const trimmed = String(id || '').trim();
  if (!trimmed) return null;
  return sha256Hex(trimmed);
}
