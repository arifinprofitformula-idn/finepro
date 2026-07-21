// src/lib/tracking/metaPixelClient.js
// Meta Pixel browser loader + event helpers. Hanya dimuat SETELAH marketing
// consent diberikan (dipanggil dari TrackingProvider). Aman saat SSR (guard
// typeof window) dan tidak pernah inject script dua kali.

let loaded = false;
let currentPixelId = null;

function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function injectPixelBase() {
  /* eslint-disable */
  if (window.fbq) return;
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    t = b.createElement(e);
    t.async = true;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
}

// initMetaPixel(pixelId) -> idempotent. Dipanggil hanya setelah marketing consent = granted.
export function initMetaPixel(pixelId) {
  if (!isBrowser() || !pixelId) return;
  if (loaded && currentPixelId === pixelId) return;

  injectPixelBase();
  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');
  loaded = true;
  currentPixelId = pixelId;
}

export function isMetaPixelLoaded() {
  return loaded;
}

// trackMetaBrowserEvent({ eventName, eventId, parameters, custom }) -> fbq('track'|'trackCustom', ...) dengan eventID untuk dedup CAPI.
export function trackMetaBrowserEvent({ eventName, eventId, parameters = {}, custom = false }) {
  if (!isBrowser() || !window.fbq || !loaded) return;
  const method = custom ? 'trackCustom' : 'track';
  const options = eventId ? { eventID: eventId } : undefined;
  window.fbq(method, eventName, parameters, options);
}
