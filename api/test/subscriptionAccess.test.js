import test from 'node:test';
import assert from 'node:assert/strict';
import { isSubscriptionExemptPath } from '../middleware/subscriptionAccess.js';

test('payment, household bootstrap, auth, and health paths stay reachable without a paid plan', () => {
  for (const path of [
    '/api/auth/me',
    '/api/health',
    '/api/households',
    '/api/households/onboarding-status',
    '/api/payments/pricing',
    '/api/payments/create',
    '/api/payments/status/ORDER-1',
  ]) {
    assert.equal(isSubscriptionExemptPath(path), true, path);
  }
});

test('ledger and AI paths require active entitlement', () => {
  for (const path of [
    '/api/transactions',
    '/api/budgets',
    '/api/wallets',
    '/api/households/onboarding/opening-wallet',
    '/api/transaction-analysis/image',
    '/api/ai/insights',
  ]) {
    assert.equal(isSubscriptionExemptPath(path), false, path);
  }
});
