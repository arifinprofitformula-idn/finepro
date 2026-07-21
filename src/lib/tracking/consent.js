// src/lib/tracking/consent.js
// Consent state first-party (cookie), aman untuk SSR/build (guard typeof document).
// Kategori: necessary (selalu aktif), analytics (GA4), marketing (Meta Pixel/CAPI).

const COOKIE_NAME = 'finepro_consent';
const COOKIE_MAX_AGE_DAYS = 365;

function isBrowser() {
  return typeof document !== 'undefined' && typeof window !== 'undefined';
}

function readCookie(name) {
  if (!isBrowser()) return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name, value, maxAgeDays) {
  if (!isBrowser()) return;
  const maxAge = maxAgeDays * 24 * 60 * 60;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

// getConsent() -> { version, analytics, marketing, timestamp } | null kalau belum pernah memilih.
export function getConsent() {
  const raw = readCookie(COOKIE_NAME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      version: String(parsed.version || ''),
      analytics: parsed.analytics === 'granted' ? 'granted' : 'denied',
      marketing: parsed.marketing === 'granted' ? 'granted' : 'denied',
      timestamp: parsed.timestamp || null,
    };
  } catch {
    return null;
  }
}

export function setConsent({ version, analytics, marketing }) {
  const value = JSON.stringify({
    version: String(version),
    analytics: analytics === 'granted' ? 'granted' : 'denied',
    marketing: marketing === 'granted' ? 'granted' : 'denied',
    timestamp: new Date().toISOString(),
  });
  writeCookie(COOKIE_NAME, value, COOKIE_MAX_AGE_DAYS);
}

// needsConsent(currentVersion) -> true kalau belum pernah memilih, ATAU consent_version admin berubah
// (minta persetujuan ulang), sesuai requirement.
export function needsConsent(currentVersion) {
  const consent = getConsent();
  if (!consent) return true;
  return consent.version !== String(currentVersion);
}

export const CONSENT_COOKIE_NAME = COOKIE_NAME;
