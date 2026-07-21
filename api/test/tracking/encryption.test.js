import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

before(() => {
  process.env.TRACKING_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
});

const { encryptSecret, decryptSecret, isEncryptedSecret, maskSecret } = await import('../../lib/tracking/encryption.js');

test('encrypt/decrypt roundtrip returns original plaintext', () => {
  const plain = 'EAAG-super-secret-access-token-12345';
  const encrypted = encryptSecret(plain);
  assert.notEqual(encrypted, plain);
  assert.equal(decryptSecret(encrypted), plain);
});

test('encrypting the same value twice yields different ciphertext (random IV)', () => {
  const plain = 'same-secret-value';
  const a = encryptSecret(plain);
  const b = encryptSecret(plain);
  assert.notEqual(a, b);
  assert.equal(decryptSecret(a), plain);
  assert.equal(decryptSecret(b), plain);
});

test('empty value encrypts/decrypts to empty string', () => {
  assert.equal(encryptSecret(''), '');
  assert.equal(decryptSecret(''), '');
});

test('isEncryptedSecret only recognizes our versioned prefix', () => {
  const encrypted = encryptSecret('token-value');
  assert.equal(isEncryptedSecret(encrypted), true);
  assert.equal(isEncryptedSecret('plain-text-token'), false);
  assert.equal(isEncryptedSecret(''), false);
});

test('corrupted ciphertext fails to decrypt (auth tag mismatch)', () => {
  const encrypted = encryptSecret('another-secret');
  const tampered = encrypted.slice(0, -4) + 'AAAA';
  assert.throws(() => decryptSecret(tampered));
});

test('maskSecret never reveals the original value', () => {
  assert.equal(maskSecret('super-secret'), '••••••••');
  assert.equal(maskSecret(''), '');
});
