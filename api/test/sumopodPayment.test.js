import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSumopodPaymentPayload,
  createSumopodPayment,
  extractSumopodPaymentResult,
  extractSumopodWebhookReference,
  mapSumopodEvent,
  resolveSumopodConfig,
  safeTokenEqual,
} from '../services/sumopodPayment.js';

test('buildSumopodPaymentPayload creates FinePro QRIS request', () => {
  assert.deepEqual(buildSumopodPaymentPayload({ orderId: 'SUB-123-abc', amount: 35000 }), {
    order_id: 'SUB-123-abc',
    amount: 35000,
    currency: 'IDR',
    expires_in_hours: 24,
    success_return_url: 'https://finepro.my.id/payment/success?order_id=SUB-123-abc',
    cancel_return_url: 'https://finepro.my.id/payment/cancel?order_id=SUB-123-abc',
    payment_method_type_code: 'QRIS',
  });
});

test('extractSumopodPaymentResult accepts top-level response fields', () => {
  assert.deepEqual(extractSumopodPaymentResult({ payment_id: 'pay_123', payment_link_url: 'https://pay.example/123' }), {
    paymentId: 'pay_123',
    paymentLinkUrl: 'https://pay.example/123',
  });
});

test('extractSumopodPaymentResult accepts nested data response fields', () => {
  assert.deepEqual(extractSumopodPaymentResult({ data: { payment_id: 'pay_456', payment_link_url: 'https://pay.example/456' } }), {
    paymentId: 'pay_456',
    paymentLinkUrl: 'https://pay.example/456',
  });
});

test('extractSumopodPaymentResult rejects incomplete provider response', () => {
  assert.throws(() => extractSumopodPaymentResult({ payment_id: 'pay_123' }), /payment_link_url/);
});

test('createSumopodPayment sends API key and parses provider response', async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 201, json: async () => ({ data: { payment_id: 'pay_789', payment_link_url: 'https://pay.example/789' } }) };
  };
  const result = await createSumopodPayment({ apiKey: 'test-key', orderId: 'SUB-789', amount: 79000, fetchImpl });
  assert.equal(request.url, 'https://api-pay.sumopod.com/api/v1/payments');
  assert.equal(request.options.headers['X-Api-Key'], 'test-key');
  assert.equal(JSON.parse(request.options.body).payment_method_type_code, 'QRIS');
  assert.deepEqual(result, { paymentId: 'pay_789', paymentLinkUrl: 'https://pay.example/789' });
});

test('createSumopodPayment does not leak provider response in user-facing error', async () => {
  const fetchImpl = async () => ({ ok: false, status: 401, json: async () => ({ message: 'secret provider detail' }) });
  await assert.rejects(
    createSumopodPayment({ apiKey: 'bad-key', orderId: 'SUB-401', amount: 35000, fetchImpl }),
    (error) => error.code === 'SUMOPOD_HTTP_ERROR' && error.status === 401 && !error.message.includes('secret provider detail')
  );
});

test('safeTokenEqual compares webhook tokens without length exception', () => {
  assert.equal(safeTokenEqual('same-token', 'same-token'), true);
  assert.equal(safeTokenEqual('wrong', 'same-token'), false);
  assert.equal(safeTokenEqual('', 'same-token'), false);
});

test('mapSumopodEvent maps supported events to canonical payment status', () => {
  assert.equal(mapSumopodEvent('payment.completed'), 'paid');
  assert.equal(mapSumopodEvent('payment.failed'), 'failed');
  assert.equal(mapSumopodEvent('payment.expired'), 'expired');
  assert.equal(mapSumopodEvent('payment.pending'), null);
});


test('extractSumopodWebhookReference reads event and nested order reference', () => {
  assert.deepEqual(extractSumopodWebhookReference({
    event_type: 'payment.completed',
    data: { payment_id: 'pay_123', order_id: 'SUB-123' },
  }), {
    eventType: 'payment.completed',
    nextStatus: 'paid',
    orderId: 'SUB-123',
    paymentId: 'pay_123',
  });
});

test('extractSumopodWebhookReference rejects supported event without order_id', () => {
  assert.throws(
    () => extractSumopodWebhookReference({ event_type: 'payment.failed', data: { payment_id: 'pay_123' } }),
    /order_id/
  );
});

test('extractSumopodWebhookReference marks unknown events as ignored', () => {
  assert.deepEqual(extractSumopodWebhookReference({ event_type: 'payment.created', data: {} }), {
    eventType: 'payment.created',
    nextStatus: null,
    orderId: null,
    paymentId: null,
  });
});


test('resolveSumopodConfig lets environment credentials override empty DB seed', () => {
  assert.deepEqual(resolveSumopodConfig(
    { enabled: false, api_key: '', webhook_token: '', base_url: 'https://api-pay.sumopod.com' },
    { SUMOPOD_PAYMENT_API_KEY: 'env-key', SUMOPOD_PAYMENT_WEBHOOK_TOKEN: 'env-token' }
  ), {
    enabled: true,
    api_key: 'env-key',
    webhook_token: 'env-token',
    base_url: 'https://api-pay.sumopod.com',
  });
});
