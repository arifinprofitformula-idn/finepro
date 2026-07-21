// api/lib/tracking/encryption.js
// AES-256-GCM helpers untuk menyimpan Meta Access Token & GA4 API Secret
// terenkripsi di kolom app_settings.tracking. Key hanya berasal dari env
// server (TRACKING_ENCRYPTION_KEY, base64 32-byte) — tidak pernah dari DB
// atau request, dan tidak pernah dikirim ke browser.

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const PAYLOAD_VERSION = 'v1';
const PREFIX = `tenc:${PAYLOAD_VERSION}:`;

let cachedKey;

function loadKey() {
  if (cachedKey) return cachedKey;
  const raw = process.env.TRACKING_ENCRYPTION_KEY || '';
  if (!raw) {
    throw new Error('TRACKING_ENCRYPTION_KEY belum diisi di environment server');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('TRACKING_ENCRYPTION_KEY harus berupa 32 byte random key yang di-encode Base64');
  }
  cachedKey = key;
  return cachedKey;
}

// encryptSecret(value) -> string tersimpan di DB, format: tenc:v1:<iv>:<tag>:<ciphertext> (base64url per bagian)
export function encryptSecret(value) {
  const plain = String(value ?? '');
  if (!plain) return '';

  const key = loadKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${ciphertext.toString('base64url')}`;
}

export function isEncryptedSecret(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

// decryptSecret(value) -> plaintext string, atau '' kalau kosong/tidak terenkripsi.
// Melempar error kalau payload rusak atau auth tag tidak cocok (data ditempel/diubah).
export function decryptSecret(value) {
  if (!value) return '';
  if (!isEncryptedSecret(value)) return '';

  const key = loadKey();
  const body = value.slice(PREFIX.length);
  const parts = body.split(':');
  if (parts.length !== 3) {
    throw new Error('Format secret terenkripsi tidak valid');
  }

  const [ivB64, tagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, 'base64url');
  const tag = Buffer.from(tagB64, 'base64url');
  const ciphertext = Buffer.from(ciphertextB64, 'base64url');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString('utf8');
}

export function maskSecret(value) {
  if (!value) return '';
  return '••••••••';
}
