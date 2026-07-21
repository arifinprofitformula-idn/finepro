import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { normalizeAndHashEmail, normalizeAndHashPhone, hashExternalId } from '../../lib/tracking/normalize.js';

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

test('email is trimmed, lowercased, then hashed', () => {
  const hash = normalizeAndHashEmail('  User@Example.COM  ');
  assert.equal(hash, sha256Hex('user@example.com'));
});

test('invalid email returns null', () => {
  assert.equal(normalizeAndHashEmail('not-an-email'), null);
  assert.equal(normalizeAndHashEmail(''), null);
  assert.equal(normalizeAndHashEmail(undefined), null);
});

test('phone strips symbols/spaces before hashing, does not guess country code', () => {
  const hash = normalizeAndHashPhone('+62 812-3456-7890');
  assert.equal(hash, sha256Hex('6281234567890'));
});

test('short/invalid phone returns null', () => {
  assert.equal(normalizeAndHashPhone('123'), null);
  assert.equal(normalizeAndHashPhone(''), null);
});

test('hashExternalId hashes a trimmed id', () => {
  assert.equal(hashExternalId(' user-123 '), sha256Hex('user-123'));
  assert.equal(hashExternalId(''), null);
});
