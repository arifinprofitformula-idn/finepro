// src/lib/tracking/anonymousId.js
// ID first-party stabil (bukan PII) dipakai untuk UTM attribution & sebagai
// fallback GA4 client_id kalau _ga cookie belum terbaca. Dibuat SEKALI dan
// dipertahankan lewat cookie — tidak pernah dibuat ulang per event.

const COOKIE_NAME = 'finepro_aid';
const COOKIE_MAX_AGE_DAYS = 400;

function isBrowser() {
  return typeof document !== 'undefined' && typeof window !== 'undefined' && typeof crypto !== 'undefined';
}

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name, value, maxAgeDays) {
  const maxAge = maxAgeDays * 24 * 60 * 60;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

export function getOrCreateAnonymousId() {
  if (!isBrowser()) return null;
  const existing = readCookie(COOKIE_NAME);
  if (existing) return existing;

  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  writeCookie(COOKIE_NAME, id, COOKIE_MAX_AGE_DAYS);
  return id;
}
