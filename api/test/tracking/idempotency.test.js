import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveEventId } from '../../lib/tracking/idempotency.js';

test('deriveEventId is deterministic for the same seed', () => {
  const a = deriveEventId('SUB-1700000000-abcd1234');
  const b = deriveEventId('SUB-1700000000-abcd1234');
  assert.equal(a, b);
});

test('deriveEventId differs for different seeds', () => {
  const a = deriveEventId('SUB-1');
  const b = deriveEventId('SUB-2');
  assert.notEqual(a, b);
});

test('deriveEventId returns a well-formed UUID v5 string', () => {
  const id = deriveEventId('order-123');
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});
