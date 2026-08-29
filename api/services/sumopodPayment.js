import crypto from 'crypto';

const SUMOPOD_PAYMENT_ENDPOINT = 'https://api-pay.sumopod.com/api/v1/payments';
const DEFAULT_BASE_URL = 'https://finepro.my.id';
const REQUEST_TIMEOUT_MS = 8_000;

function positiveInteger(value, field) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new Error(`${field} harus berupa integer positif`);
  }
  return number;
}

export function resolveSumopodConfig(stored = {}, env = process.env) {
  const apiKey = env.SUMOPOD_PAYMENT_API_KEY || stored.api_key || '';
  const webhookToken = env.SUMOPOD_PAYMENT_WEBHOOK_TOKEN || env.WEBHOOK_TOKEN || stored.webhook_token || '';
  return {
    ...stored,
    enabled: stored.enabled === true || Boolean(apiKey && webhookToken),
    api_key: apiKey,
    webhook_token: webhookToken,
    base_url: env.SUMOPOD_PAYMENT_BASE_URL || stored.base_url || 'https://api-pay.sumopod.com',
  };
}

export function buildSumopodPaymentPayload({ orderId, amount, baseUrl = DEFAULT_BASE_URL }) {
  const normalizedOrderId = String(orderId || '').trim();
  if (!normalizedOrderId) throw new Error('orderId wajib diisi');
  const normalizedBaseUrl = String(baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
  const encodedOrderId = encodeURIComponent(normalizedOrderId);

  return {
    order_id: normalizedOrderId,
    amount: positiveInteger(amount, 'amount'),
    currency: 'IDR',
    expires_in_hours: 24,
    success_return_url: `${normalizedBaseUrl}/payment/success?order_id=${encodedOrderId}`,
    cancel_return_url: `${normalizedBaseUrl}/payment/cancel?order_id=${encodedOrderId}`,
    payment_method_type_code: 'QRIS',
  };
}

export function extractSumopodPaymentResult(responseBody) {
  const body = responseBody?.data && typeof responseBody.data === 'object'
    ? responseBody.data
    : responseBody;
  const paymentId = body?.payment_id;
  const paymentLinkUrl = body?.payment_link_url;
  if (!paymentId) throw new Error('Response SumoPod tidak memiliki payment_id');
  if (!paymentLinkUrl) throw new Error('Response SumoPod tidak memiliki payment_link_url');
  return { paymentId: String(paymentId), paymentLinkUrl: String(paymentLinkUrl) };
}

export async function createSumopodPayment({ apiKey, orderId, amount, baseUrl, fetchImpl = fetch }) {
  if (!apiKey) {
    const error = new Error('SumoPod Payment belum dikonfigurasi');
    error.code = 'SUMOPOD_NOT_CONFIGURED';
    throw error;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(SUMOPOD_PAYMENT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify(buildSumopodPaymentPayload({ orderId, amount, baseUrl })),
      signal: controller.signal,
    });
    let responseBody = {};
    try {
      responseBody = await response.json();
    } catch {
      responseBody = {};
    }
    if (!response.ok) {
      const error = new Error(`SumoPod Payment menolak permintaan (HTTP ${response.status})`);
      error.code = 'SUMOPOD_HTTP_ERROR';
      error.status = response.status;
      throw error;
    }
    return extractSumopodPaymentResult(responseBody);
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('SumoPod Payment timeout');
      timeoutError.code = 'SUMOPOD_TIMEOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function extractSumopodWebhookReference(payload) {
  const eventType = String(payload?.event_type || '');
  const nextStatus = mapSumopodEvent(eventType);
  if (!nextStatus) {
    return { eventType, nextStatus: null, orderId: null, paymentId: null };
  }
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};
  const orderId = data.order_id || data.orderId || null;
  const paymentId = data.payment_id || data.paymentId || null;
  if (!orderId) throw new Error('Webhook SumoPod tidak memiliki order_id');
  return {
    eventType,
    nextStatus,
    orderId: String(orderId),
    paymentId: paymentId ? String(paymentId) : null,
  };
}

export function safeTokenEqual(received, expected) {
  if (!received || !expected) return false;
  const receivedBuffer = Buffer.from(String(received));
  const expectedBuffer = Buffer.from(String(expected));
  if (receivedBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

export function mapSumopodEvent(eventType) {
  if (eventType === 'payment.completed') return 'paid';
  if (eventType === 'payment.failed') return 'failed';
  if (eventType === 'payment.expired') return 'expired';
  return null;
}
