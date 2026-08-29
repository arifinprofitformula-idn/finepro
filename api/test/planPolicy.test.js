import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SELLABLE_PLANS,
  PLAN_MONTHS,
  DEFAULT_PLAN_PRICES,
  recurringFairUseLimit,
  resolveSubscriptionEntitlement,
} from '../services/planPolicy.js';

test('monthly is sellable for Rp35.000 and lasts one month', () => {
  assert.equal(SELLABLE_PLANS.has('monthly'), true);
  assert.equal(PLAN_MONTHS.monthly, 1);
  assert.equal(DEFAULT_PLAN_PRICES.monthly, 35000);
});

test('all recurring paid plans receive same unlimited fair-use policy', () => {
  for (const plan of ['monthly', 'quarterly', 'annual']) {
    assert.deepEqual(recurringFairUseLimit(plan, 'receipt_scan'), { scope: 'day', limit: 200 });
    assert.deepEqual(recurringFairUseLimit(plan, 'ai_insight'), { scope: 'day', limit: 30 });
    assert.deepEqual(recurringFairUseLimit(plan, 'telegram_chat'), { scope: 'day', limit: 500 });
    assert.deepEqual(recurringFairUseLimit(plan, 'whatsapp_chat'), { scope: 'day', limit: 500 });
  }
});

test('lifetime stays finite-credit and pending payment stays locked', () => {
  assert.equal(recurringFairUseLimit('lifetime', 'receipt_scan'), null);
  assert.deepEqual(resolveSubscriptionEntitlement({ plan: 'lifetime', status: 'active' }), {
    access: true,
    mode: 'finite_credit',
  });
  assert.deepEqual(resolveSubscriptionEntitlement({ plan: 'monthly', status: 'pending_payment' }), {
    access: false,
    mode: 'payment_required',
  });
});

test('existing active trial remains entitled through its recorded end date', () => {
  assert.deepEqual(resolveSubscriptionEntitlement({
    plan: 'trial',
    status: 'active',
    current_period_end: '2026-08-29',
  }, new Date('2026-08-29T23:59:59Z')), {
    access: true,
    mode: 'legacy_trial',
  });
});

test('expired and absent subscriptions are locked', () => {
  assert.equal(resolveSubscriptionEntitlement(null).access, false);
  assert.equal(resolveSubscriptionEntitlement({ plan: 'monthly', status: 'expired' }).access, false);
});
