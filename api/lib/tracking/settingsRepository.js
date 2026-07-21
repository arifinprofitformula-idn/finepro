// api/lib/tracking/settingsRepository.js
// Settings singleton untuk tracking, disimpan di app_settings (key='tracking'),
// sama seperti integrasi lain (lihat api/services/appSettings.js) — tapi field
// secret (meta_access_token, meta_test_event_code, ga4_api_secret) dienkripsi
// AES-256-GCM sebelum masuk DB, bukan disimpan plaintext seperti integrasi lain.
// Repository ini singleton (site_key implisit = 'default') tapi query selalu
// lewat site_key supaya gampang dikembangkan ke multi-tenant nanti.

import pool from '../../db.js';
import { encryptSecret, decryptSecret, isEncryptedSecret } from './encryption.js';

const SETTINGS_KEY = 'tracking';
const DEFAULT_SITE_KEY = 'default';

const DEFAULTS = {
  site_key: DEFAULT_SITE_KEY,
  meta_browser_enabled: false,
  meta_server_enabled: false,
  meta_pixel_id: '',
  meta_access_token_encrypted: '',
  meta_test_event_code_encrypted: '',
  meta_graph_api_version: 'v21.0',
  ga4_browser_enabled: false,
  ga4_server_enabled: false,
  ga4_measurement_id: '',
  ga4_api_secret_encrypted: '',
  ga4_region: 'global',
  consent_banner_enabled: true,
  consent_version: '1',
  default_analytics_consent: 'denied',
  default_marketing_consent: 'denied',
  privacy_policy_url: '/privacy',
  cookie_policy_url: '/privacy',
  banner_title: 'Kami menghargai privasi kamu',
  banner_description: 'FinePro menggunakan cookie untuk analitik dan iklan agar pengalaman kamu lebih baik. Kamu bisa memilih kategori cookie yang diizinkan.',
  tracking_debug_enabled: false,
  exclude_admin_routes: true,
  exclude_authenticated_admins: true,
  utm_retention_days: 180,
  event_mapping_json: {},
  last_meta_test_at: null,
  last_meta_test_status: null,
  last_meta_test_message: null,
  last_ga4_test_at: null,
  last_ga4_test_status: null,
  last_ga4_test_message: null,
};

const SECRET_FIELD_MAP = {
  meta_access_token: 'meta_access_token_encrypted',
  meta_test_event_code: 'meta_test_event_code_encrypted',
  ga4_api_secret: 'ga4_api_secret_encrypted',
};

const PLAIN_ALLOWED_FIELDS = [
  'meta_browser_enabled',
  'meta_server_enabled',
  'meta_pixel_id',
  'meta_graph_api_version',
  'ga4_browser_enabled',
  'ga4_server_enabled',
  'ga4_measurement_id',
  'ga4_region',
  'consent_banner_enabled',
  'consent_version',
  'default_analytics_consent',
  'default_marketing_consent',
  'privacy_policy_url',
  'cookie_policy_url',
  'banner_title',
  'banner_description',
  'tracking_debug_enabled',
  'exclude_admin_routes',
  'exclude_authenticated_admins',
  'utm_retention_days',
  'event_mapping_json',
];

// getRawSettings() -> object mentah dari DB (secret masih terenkripsi), dipakai internal (server-only).
export async function getRawSettings() {
  const result = await pool.query('SELECT value FROM app_settings WHERE key = $1', [SETTINGS_KEY]);
  const stored = result.rows[0]?.value || {};
  return { ...DEFAULTS, ...stored };
}

// getDecryptedSettings() -> secret di-decrypt jadi plaintext. HANYA dipanggil
// server-side saat benar-benar mengirim event ke provider (Meta/GA4). Tidak
// pernah diserialize langsung ke response HTTP.
export async function getDecryptedSettings() {
  const raw = await getRawSettings();
  return {
    ...raw,
    meta_access_token: decryptSecret(raw.meta_access_token_encrypted),
    meta_test_event_code: decryptSecret(raw.meta_test_event_code_encrypted),
    ga4_api_secret: decryptSecret(raw.ga4_api_secret_encrypted),
  };
}

// toAdminView(raw) -> aman dikirim ke admin UI: secret jadi hasSecret boolean, tidak pernah plaintext/masked value asli.
export function toAdminView(raw) {
  const { meta_access_token_encrypted, meta_test_event_code_encrypted, ga4_api_secret_encrypted, ...rest } = raw;
  return {
    ...rest,
    meta_access_token_configured: isEncryptedSecret(meta_access_token_encrypted),
    meta_test_event_code_configured: isEncryptedSecret(meta_test_event_code_encrypted),
    ga4_api_secret_configured: isEncryptedSecret(ga4_api_secret_encrypted),
  };
}

// toPublicSettings(raw) -> subset AMAN untuk browser (dipakai TrackingProvider). Tidak pernah mengandung secret/status internal.
export function toPublicSettings(raw) {
  return {
    metaBrowserEnabled: Boolean(raw.meta_browser_enabled) && Boolean(raw.meta_pixel_id),
    metaPixelId: raw.meta_browser_enabled ? (raw.meta_pixel_id || '') : '',
    gaBrowserEnabled: Boolean(raw.ga4_browser_enabled) && Boolean(raw.ga4_measurement_id),
    gaMeasurementId: raw.ga4_browser_enabled ? (raw.ga4_measurement_id || '') : '',
    consent: {
      bannerEnabled: Boolean(raw.consent_banner_enabled),
      version: String(raw.consent_version || '1'),
      defaultAnalytics: raw.default_analytics_consent === 'granted' ? 'granted' : 'denied',
      defaultMarketing: raw.default_marketing_consent === 'granted' ? 'granted' : 'denied',
      privacyPolicyUrl: raw.privacy_policy_url || '/privacy',
      cookiePolicyUrl: raw.cookie_policy_url || '/privacy',
      bannerTitle: raw.banner_title || '',
      bannerDescription: raw.banner_description || '',
    },
    excludeAdminRoutes: Boolean(raw.exclude_admin_routes),
    debug: Boolean(raw.tracking_debug_enabled) && process.env.NODE_ENV !== 'production',
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  };
}

// updateSettings(patch, userId) -> validasi, enkripsi secret baru, simpan. Secret kosong ('') mempertahankan yang lama.
export async function updateSettings(patch, userId) {
  const current = await getRawSettings();
  const next = { ...current };

  for (const field of PLAIN_ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(patch, field)) {
      next[field] = patch[field];
    }
  }

  for (const [plainField, encryptedField] of Object.entries(SECRET_FIELD_MAP)) {
    if (!Object.prototype.hasOwnProperty.call(patch, plainField)) continue;
    const value = patch[plainField];
    if (value === '' || value === null || value === undefined) continue; // kosong = pertahankan secret lama
    next[encryptedField] = encryptSecret(String(value));
  }

  // Validasi: server tracking tidak boleh aktif tanpa kredensial lengkap.
  const hasMetaToken = isEncryptedSecret(next.meta_access_token_encrypted);
  if (next.meta_server_enabled && (!next.meta_pixel_id || !hasMetaToken)) {
    const err = new Error('Meta CAPI tidak bisa diaktifkan sebelum Pixel ID dan Access Token diisi');
    err.code = 'TRACKING_CONFIG_INVALID';
    throw err;
  }
  const hasGa4Secret = isEncryptedSecret(next.ga4_api_secret_encrypted);
  if (next.ga4_server_enabled && (!next.ga4_measurement_id || !hasGa4Secret)) {
    const err = new Error('GA4 Measurement Protocol tidak bisa diaktifkan sebelum Measurement ID dan API Secret diisi');
    err.code = 'TRACKING_CONFIG_INVALID';
    throw err;
  }
  if (next.meta_pixel_id && !/^\d{5,20}$/.test(String(next.meta_pixel_id))) {
    const err = new Error('Meta Pixel ID harus berupa angka');
    err.code = 'TRACKING_CONFIG_INVALID';
    throw err;
  }
  if (next.meta_graph_api_version && !/^v\d{1,2}\.\d$/.test(String(next.meta_graph_api_version))) {
    const err = new Error('Meta Graph API Version harus mengikuti pola vXX.X');
    err.code = 'TRACKING_CONFIG_INVALID';
    throw err;
  }
  if (next.ga4_measurement_id && !/^G-[A-Z0-9]{6,12}$/.test(String(next.ga4_measurement_id))) {
    const err = new Error('GA4 Measurement ID harus mengikuti pola G-XXXXXXXXXX');
    err.code = 'TRACKING_CONFIG_INVALID';
    throw err;
  }

  await pool.query(
    `INSERT INTO app_settings (key, value, is_secret, updated_by, updated_at)
     VALUES ($1, $2, true, $3, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [SETTINGS_KEY, JSON.stringify(next), userId]
  );

  return next;
}

export async function clearSecret(field, userId) {
  const encryptedField = SECRET_FIELD_MAP[field];
  if (!encryptedField) {
    const err = new Error('Field secret tidak dikenal');
    err.code = 'TRACKING_CONFIG_INVALID';
    throw err;
  }
  const current = await getRawSettings();
  const next = { ...current, [encryptedField]: '' };

  await pool.query(
    `INSERT INTO app_settings (key, value, is_secret, updated_by, updated_at)
     VALUES ($1, $2, true, $3, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [SETTINGS_KEY, JSON.stringify(next), userId]
  );
  return next;
}

export async function recordTestResult(provider, status, message) {
  const current = await getRawSettings();
  const next = { ...current };
  const safeMessage = String(message || '').slice(0, 500);
  if (provider === 'meta') {
    next.last_meta_test_at = new Date().toISOString();
    next.last_meta_test_status = status;
    next.last_meta_test_message = safeMessage;
  } else if (provider === 'ga4') {
    next.last_ga4_test_at = new Date().toISOString();
    next.last_ga4_test_status = status;
    next.last_ga4_test_message = safeMessage;
  }
  await pool.query(
    `INSERT INTO app_settings (key, value, is_secret, updated_at)
     VALUES ($1, $2, true, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [SETTINGS_KEY, JSON.stringify(next)]
  );
}
