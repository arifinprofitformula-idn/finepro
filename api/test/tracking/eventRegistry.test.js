import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidEventName,
  resolveEventMapping,
  filterParameters,
  DEFAULT_EVENT_MAPPING,
  INTERNAL_EVENT_NAMES,
  wouldGa4DoubleCount,
} from '../../lib/tracking/eventRegistry.js';

test('isValidEventName accepts letters/digits/underscore starting with a letter', () => {
  assert.equal(isValidEventName('registration_completed'), true);
  assert.equal(isValidEventName('page_view2'), true);
});

test('isValidEventName rejects unsafe or malformed names', () => {
  assert.equal(isValidEventName(''), false);
  assert.equal(isValidEventName('1_starts_with_digit'), false);
  assert.equal(isValidEventName('has space'), false);
  assert.equal(isValidEventName('<script>alert(1)</script>'), false);
  assert.equal(isValidEventName('a'.repeat(65)), false);
});

test('all default registry events are enabled and valid by default', () => {
  const resolved = resolveEventMapping({});
  for (const name of INTERNAL_EVENT_NAMES) {
    assert.equal(resolved[name].enabled, true);
    assert.equal(resolved[name].meta.eventName, DEFAULT_EVENT_MAPPING[name].meta.eventName);
    assert.equal(resolved[name].ga4.eventName, DEFAULT_EVENT_MAPPING[name].ga4.eventName);
  }
});

test('admin override can disable an event and rename provider event names', () => {
  const resolved = resolveEventMapping({
    budget_created: { enabled: false, meta: { eventName: 'CustomBudget' }, ga4: { channel: 'browser' } },
  });
  assert.equal(resolved.budget_created.enabled, false);
  assert.equal(resolved.budget_created.meta.eventName, 'CustomBudget');
  assert.equal(resolved.budget_created.ga4.channel, 'browser');
});

test('override with an invalid event name falls back to the default', () => {
  const resolved = resolveEventMapping({
    page_view: { meta: { eventName: 'bad name!' } },
  });
  assert.equal(resolved.page_view.meta.eventName, DEFAULT_EVENT_MAPPING.page_view.meta.eventName);
});

test('filterParameters drops any key not in the event allowlist', () => {
  const filtered = filterParameters('subscription_purchased', {
    currency: 'IDR',
    value: 249000,
    plan_id: 'annual',
    transaction_id: 'SUB-123',
    // not in allowlist for this event:
    note: 'user diary text',
    account_number: '1234567890',
  });
  assert.deepEqual(filtered, { currency: 'IDR', value: 249000, plan_id: 'annual', transaction_id: 'SUB-123' });
});

test('filterParameters never leaks sensitive financial fields regardless of allowlist', () => {
  const sensitiveKeys = ['amount', 'balance', 'saldo', 'note', 'merchant', 'account_number', 'password'];
  for (const eventName of INTERNAL_EVENT_NAMES) {
    const params = Object.fromEntries(sensitiveKeys.map((k) => [k, 'sensitive-value']));
    const filtered = filterParameters(eventName, params);
    for (const key of sensitiveKeys) {
      assert.equal(Object.prototype.hasOwnProperty.call(filtered, key), false, `${eventName} leaked ${key}`);
    }
  }
});

test('filterParameters returns empty object for unknown event name', () => {
  assert.deepEqual(filterParameters('not_a_real_event', { a: 1 }), {});
});

test('wouldGa4DoubleCount flags browser_and_server GA4 channel', () => {
  assert.equal(wouldGa4DoubleCount('registration_completed', 'server', 'browser_and_server'), true);
  assert.equal(wouldGa4DoubleCount('registration_completed', 'server', 'server'), false);
});
