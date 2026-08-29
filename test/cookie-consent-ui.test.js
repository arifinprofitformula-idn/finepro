import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/tracking/CookieConsentBanner.jsx', import.meta.url), 'utf8');

test('cookie consent uses modal semantics and separates page with backdrop', () => {
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /bg-navy\/50/);
  assert.match(source, /bg-white/);
});

test('mobile consent actions are stacked without flex wrapping or overlap', () => {
  assert.match(source, /grid grid-cols-1/);
  assert.doesNotMatch(source, /mt-3 flex flex-wrap gap-2/);
  assert.match(source, /min-h-\[48px\]/);
  assert.match(source, /env\(safe-area-inset-bottom\)/);
});

test('copy explains essential and non-essential cookies directly', () => {
  assert.match(source, /Pengaturan cookie/);
  assert.match(source, /Cookie esensial selalu aktif/);
  assert.match(source, /Tolak non-esensial/);
  assert.match(source, /Terima semua/);
  assert.match(source, /Atur preferensi/);
});
