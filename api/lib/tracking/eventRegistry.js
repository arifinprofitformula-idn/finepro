// api/lib/tracking/eventRegistry.js
// Registry typed untuk internal event -> provider event mapping. Admin bisa
// override sebagian field (enabled, channel, provider event name) lewat
// tracking.event_mapping_json, tapi struktur & allowlist parameter tetap
// dikunci di sini supaya tidak ada string event bebas tersebar di codebase.

export const EVENT_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;

export function isValidEventName(name) {
  return typeof name === 'string' && EVENT_NAME_PATTERN.test(name);
}

// Channel GA4 default per event — dipisah dari Meta karena aturan double-counting
// GA4 (default satu channel per event) berbeda dari Meta (boleh browser+server
// dengan dedup event_id).
export const DEFAULT_EVENT_MAPPING = {
  page_view: {
    trigger: 'Setiap perpindahan halaman (SPA) setelah consent analytics/marketing diberikan',
    meta: { eventName: 'PageView', channel: 'browser' },
    ga4: { eventName: 'page_view', channel: 'browser' },
    allowedParams: ['page_path', 'page_location', 'source', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'],
    consentCategory: 'analytics_or_marketing',
  },
  view_landing_page: {
    trigger: 'Landing page publik dibuka',
    meta: { eventName: 'ViewContent', channel: 'browser' },
    ga4: { eventName: 'view_landing_page', channel: 'browser' },
    allowedParams: ['content_name', 'content_category', 'page_path', 'page_location', 'source'],
    consentCategory: 'marketing',
  },
  primary_cta_clicked: {
    trigger: 'Tombol CTA utama (mis. "Coba Gratis") diklik',
    meta: { eventName: 'CTA_Click', channel: 'browser' },
    ga4: { eventName: 'select_content', channel: 'browser' },
    allowedParams: ['content_name', 'content_category', 'page_path', 'source', 'method'],
    consentCategory: 'marketing',
  },
  registration_started: {
    trigger: 'Form registrasi pertama kali disubmit (bukan sekadar halaman dibuka)',
    meta: { eventName: 'Lead', channel: 'browser' },
    ga4: { eventName: 'generate_lead', channel: 'browser' },
    allowedParams: ['method', 'source', 'page_path'],
    consentCategory: 'marketing',
  },
  registration_completed: {
    trigger: 'Akun berhasil dibuat di database (server-authoritative)',
    meta: { eventName: 'CompleteRegistration', channel: 'browser_and_server' },
    ga4: { eventName: 'sign_up', channel: 'server' },
    allowedParams: ['method', 'trial_days', 'source', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'],
    consentCategory: 'marketing',
  },
  trial_started: {
    trigger: 'Trial aktif di database (di FinePro terjadi bersamaan dengan registrasi)',
    meta: { eventName: 'StartTrial', channel: 'browser_and_server' },
    ga4: { eventName: 'start_trial', channel: 'server' },
    allowedParams: ['trial_days', 'plan_id', 'source'],
    consentCategory: 'marketing',
  },
  first_transaction_created: {
    trigger: 'Transaksi pertama household berhasil disimpan (tanpa nominal/kategori)',
    meta: { eventName: 'FirstTransaction', channel: 'server' },
    ga4: { eventName: 'first_transaction', channel: 'server' },
    allowedParams: ['source'],
    consentCategory: 'marketing',
  },
  receipt_uploaded: {
    trigger: 'Upload struk diterima sistem (tanpa isi struk/merchant/nominal)',
    meta: { eventName: 'ReceiptUploaded', channel: 'server' },
    ga4: { eventName: 'receipt_uploaded', channel: 'server' },
    allowedParams: ['source'],
    consentCategory: 'marketing',
  },
  budget_created: {
    trigger: 'Budget kategori baru berhasil disimpan (tanpa nilai budget)',
    meta: { eventName: 'BudgetCreated', channel: 'server' },
    ga4: { eventName: 'budget_created', channel: 'server' },
    allowedParams: ['source'],
    consentCategory: 'marketing',
  },
  subscription_purchased: {
    trigger: 'Pembayaran langganan FinePro dikonfirmasi sukses oleh gateway',
    meta: { eventName: 'Purchase', channel: 'browser_and_server' },
    ga4: { eventName: 'purchase', channel: 'server' },
    allowedParams: ['currency', 'value', 'plan_id', 'transaction_id', 'method', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'],
    consentCategory: 'marketing',
  },
};

export const INTERNAL_EVENT_NAMES = Object.keys(DEFAULT_EVENT_MAPPING);

// GA4 events allowed to run browser+server simultaneously despite the default
// single-channel rule, because business boundaries make double counting
// structurally impossible (registration/trial/purchase each fire exactly once
// server-side per user, and are never additionally fired browser-side for GA4).
const GA4_DUAL_CHANNEL_SAFE = new Set([]);

export function wouldGa4DoubleCount(eventName, metaChannel, ga4Channel) {
  if (GA4_DUAL_CHANNEL_SAFE.has(eventName)) return false;
  // GA4 double counting hanya relevan kalau admin secara eksplisit mencoba
  // mengaktifkan GA4 browser DAN server untuk event yang sama sekaligus —
  // pengecekan aktual dilakukan di trackingRepository saat validasi settings.
  return ga4Channel === 'browser_and_server';
}

// Gabungkan default registry dengan override admin (event_mapping_json).
// Override hanya boleh mengubah: enabled, meta.channel, meta.eventName, ga4.channel, ga4.eventName.
export function resolveEventMapping(overrides = {}) {
  const resolved = {};
  for (const [eventName, def] of Object.entries(DEFAULT_EVENT_MAPPING)) {
    const override = overrides?.[eventName] || {};
    resolved[eventName] = {
      eventName,
      enabled: override.enabled !== undefined ? Boolean(override.enabled) : true,
      trigger: def.trigger,
      consentCategory: def.consentCategory,
      allowedParams: def.allowedParams,
      meta: {
        eventName: isValidEventName(override.meta?.eventName) ? override.meta.eventName : def.meta.eventName,
        channel: ['browser', 'server', 'browser_and_server', 'none'].includes(override.meta?.channel)
          ? override.meta.channel
          : def.meta.channel,
      },
      ga4: {
        eventName: isValidEventName(override.ga4?.eventName) ? override.ga4.eventName : def.ga4.eventName,
        channel: ['browser', 'server', 'none'].includes(override.ga4?.channel) ? override.ga4.channel : def.ga4.channel,
      },
    };
  }
  return resolved;
}

// filterParameters(eventName, params) -> hanya field yang ada di allowlist event tsb.
// Parameter tidak dikenal dibuang secara diam-diam (bukan error) sesuai spec.
export function filterParameters(eventName, params = {}) {
  const def = DEFAULT_EVENT_MAPPING[eventName];
  if (!def) return {};
  const allowed = new Set(def.allowedParams);
  const filtered = {};
  for (const [key, value] of Object.entries(params || {})) {
    if (allowed.has(key) && value !== undefined && value !== null && value !== '') {
      filtered[key] = value;
    }
  }
  return filtered;
}
