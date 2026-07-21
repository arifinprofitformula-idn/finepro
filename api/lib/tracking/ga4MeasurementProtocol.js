// api/lib/tracking/ga4MeasurementProtocol.js
// Server-only client untuk GA4 Measurement Protocol. Melengkapi browser
// tracking, tidak menggantikannya — dipakai hanya untuk conversion
// server-authoritative (registrasi, trial, purchase).

const REQUEST_TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

const ENDPOINTS = {
  global: 'https://www.google-analytics.com/mp/collect',
  eu: 'https://region1.google-analytics.com/mp/collect',
};
const DEBUG_ENDPOINTS = {
  global: 'https://www.google-analytics.com/debug/mp/collect',
  eu: 'https://region1.google-analytics.com/debug/mp/collect',
};

function collectUrl(measurementId, apiSecret, region, debug) {
  const base = (debug ? DEBUG_ENDPOINTS : ENDPOINTS)[region === 'eu' ? 'eu' : 'global'];
  return `${base}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
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

export function buildGa4Payload({ clientId, userId, events, timestampMicros }) {
  const payload = {
    client_id: clientId,
    events,
  };
  if (userId) payload.user_id = userId;
  if (timestampMicros) payload.timestamp_micros = timestampMicros;
  return payload;
}

// sendGa4Event(...) -> POST ke /mp/collect. GA4 MP tidak mengembalikan body pada sukses (204).
export async function sendGa4Event({ measurementId, apiSecret, region, payload }) {
  const url = collectUrl(measurementId, apiSecret, region, false);
  const body = JSON.stringify(payload);

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt += 1) {
    try {
      const res = await fetchWithTimeout(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }, REQUEST_TIMEOUT_MS);

      if (res.status === 204 || res.ok) {
        return { ok: true, status: res.status, attempt };
      }
      if (RETRYABLE_STATUS.has(res.status) && attempt <= MAX_RETRIES) {
        await sleep(2 ** attempt * 300);
        continue;
      }
      const err = new Error(`GA4 Measurement Protocol merespons status ${res.status}`);
      err.code = 'GA4_API_ERROR';
      err.status = res.status;
      throw err;
    } catch (err) {
      lastError = err;
      if (err.name === 'AbortError') {
        const timeoutErr = new Error('GA4 Measurement Protocol request timeout');
        timeoutErr.code = 'TRACKING_PROVIDER_TIMEOUT';
        lastError = timeoutErr;
        if (attempt <= MAX_RETRIES) {
          await sleep(2 ** attempt * 300);
          continue;
        }
      }
      if (err.code) throw err;
      if (attempt > MAX_RETRIES) break;
      await sleep(2 ** attempt * 300);
    }
  }
  throw lastError || new Error('Gagal mengirim event ke GA4 Measurement Protocol');
}

// validateGa4Payload(...) -> panggil endpoint /debug/mp/collect (ENFORCE_RECOMMENDATIONS).
// Hanya memvalidasi struktur payload — event ini TIDAK masuk ke report GA4.
export async function validateGa4Payload({ measurementId, apiSecret, region, payload }) {
  const url = collectUrl(measurementId, apiSecret, region, true);
  const body = JSON.stringify({ ...payload, validation_behavior: 'ENFORCE_RECOMMENDATIONS' });

  const res = await fetchWithTimeout(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }, REQUEST_TIMEOUT_MS);
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error('GA4 validation endpoint gagal merespons');
    err.code = 'GA4_VALIDATION_FAILED';
    err.status = res.status;
    throw err;
  }

  return { validationMessages: json.validationMessages || [] };
}
