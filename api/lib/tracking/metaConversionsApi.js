// api/lib/tracking/metaConversionsApi.js
// Server-only client untuk Meta Conversions API. Tidak pernah dipakai dari
// browser bundle (hanya di-import oleh route/service di api/).

const REQUEST_TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function graphEventsUrl(graphApiVersion, pixelId) {
  return `https://graph.facebook.com/${graphApiVersion}/${pixelId}/events`;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// buildEventPayload(...) -> satu object "data" event sesuai kontrak Meta CAPI.
// user_data hanya boleh berisi field yang sudah dinormalisasi/di-hash oleh caller (lib/tracking/normalize.js).
export function buildMetaEventPayload({
  eventName,
  eventId,
  eventTime,
  eventSourceUrl,
  actionSource = 'website',
  userData = {},
  customData = {},
  testEventCode,
}) {
  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: eventTime || Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: actionSource,
        event_source_url: eventSourceUrl,
        user_data: userData,
        ...(Object.keys(customData).length ? { custom_data: customData } : {}),
      },
    ],
  };
  if (testEventCode) payload.test_event_code = testEventCode;
  return payload;
}

// sendMetaEvent(...) -> kirim satu event ke Meta CAPI. Retry hanya untuk network error/429/5xx.
// Melempar error terklasifikasi (err.code) untuk 4xx non-retryable supaya caller tidak retry percuma.
export async function sendMetaEvent({ pixelId, accessToken, graphApiVersion, payload }) {
  const url = graphEventsUrl(graphApiVersion, pixelId);
  const body = JSON.stringify(payload);

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt += 1) {
    try {
      const res = await fetchWithTimeout(
        `${url}?access_token=${encodeURIComponent(accessToken)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body },
        REQUEST_TIMEOUT_MS
      );
      const json = await res.json().catch(() => ({}));

      if (res.ok) {
        return { ok: true, status: res.status, body: json, attempt };
      }

      if (RETRYABLE_STATUS.has(res.status) && attempt <= MAX_RETRIES) {
        await sleep(2 ** attempt * 300);
        continue;
      }

      const err = new Error(json?.error?.message || `Meta CAPI merespons status ${res.status}`);
      err.code = res.status === 429 ? 'META_RATE_LIMITED' : 'META_API_ERROR';
      err.status = res.status;
      err.attempt = attempt;
      throw err;
    } catch (err) {
      lastError = err;
      if (err.name === 'AbortError') {
        const timeoutErr = new Error('Meta CAPI request timeout');
        timeoutErr.code = 'TRACKING_PROVIDER_TIMEOUT';
        lastError = timeoutErr;
        if (attempt <= MAX_RETRIES) {
          await sleep(2 ** attempt * 300);
          continue;
        }
      }
      if (err.code) throw err; // non-retryable, sudah diklasifikasi di atas
      if (attempt > MAX_RETRIES) break;
      await sleep(2 ** attempt * 300);
    }
  }
  throw lastError || new Error('Gagal mengirim event ke Meta CAPI');
}
