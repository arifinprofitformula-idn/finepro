// src/lib/tracking/ga4Client.js
// GA4 gtag.js browser loader + event helpers + Consent Mode v2 bridge. Hanya
// dimuat setelah analytics consent diberikan. Aman saat SSR.

let loaded = false;
let currentMeasurementId = null;

function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function ensureDataLayer() {
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
  }
}

// setGaConsentDefault({ analytics, marketing }) -> harus dipanggil SEBELUM gtag('js', ...) / gtag('config', ...)
// supaya Consent Mode v2 aktif sejak awal (default aman: semua denied sampai user memilih).
export function setGaConsentDefault({ analytics = 'denied', marketing = 'denied' } = {}) {
  if (!isBrowser()) return;
  ensureDataLayer();
  window.gtag('consent', 'default', {
    analytics_storage: analytics,
    ad_storage: marketing,
    ad_user_data: marketing,
    ad_personalization: marketing,
  });
}

export function updateGaConsent({ analytics, marketing }) {
  if (!isBrowser() || !window.gtag) return;
  const update = {};
  if (analytics) update.analytics_storage = analytics;
  if (marketing) {
    update.ad_storage = marketing;
    update.ad_user_data = marketing;
    update.ad_personalization = marketing;
  }
  window.gtag('consent', 'update', update);
}

// initGa4(measurementId) -> idempotent. Dipanggil hanya setelah analytics consent = granted.
// send_page_view dimatikan — page_view dikirim manual lewat RouteChangeTracker supaya tidak dobel.
export function initGa4(measurementId) {
  if (!isBrowser() || !measurementId) return;
  ensureDataLayer();

  if (!loaded) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.appendChild(script);

    window.gtag('js', new Date());
    loaded = true;
  }

  if (currentMeasurementId !== measurementId) {
    window.gtag('config', measurementId, { send_page_view: false });
    currentMeasurementId = measurementId;
  }
}

export function isGa4Loaded() {
  return loaded;
}

// trackGaBrowserEvent({ eventName, parameters }) -> gtag('event', ...). Tidak pernah mengirim PII (caller bertanggung jawab lewat allowlist).
export function trackGaBrowserEvent({ eventName, parameters = {} }) {
  if (!isBrowser() || !window.gtag || !loaded) return;
  window.gtag('event', eventName, parameters);
}

// getGaClientId() -> baca _ga cookie (format GA1.2.<client_id_part1>.<part2>) untuk dikirim ke
// backend (mis. saat registrasi/purchase) supaya GA4 Measurement Protocol server-side memakai
// client_id yang SAMA dengan browser (menghindari GA4 menganggap ini sesi/perangkat berbeda).
export function getGaClientId() {
  if (!isBrowser()) return null;
  const match = document.cookie.match(/(?:^|; )_ga=([^;]*)/);
  if (!match) return null;
  const raw = decodeURIComponent(match[1]);
  const parts = raw.split('.');
  if (parts.length < 4) return null;
  return `${parts[2]}.${parts[3]}`;
}
