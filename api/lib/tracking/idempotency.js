// api/lib/tracking/idempotency.js
// deriveEventId(seed) -> UUID v5 deterministik dari sebuah seed string (mis. order_id
// pembayaran). Dipakai saat browser dan server TIDAK berada di request yang sama
// (mis. webhook pembayaran async) tapi harus menghasilkan event_id Meta yang identik
// untuk dedup — keduanya menurunkan event_id yang sama dari order_id yang sama,
// tanpa perlu round-trip tambahan.
//
// Deduplication server-side sesungguhnya tetap dijamin oleh unique index
// (provider, channel, event_id) di tracking_event_deliveries (lihat deliveryLog.js),
// bukan oleh keacakan UUID ini.

import crypto from 'crypto';

// Namespace tetap (UUID v4 acak yang di-generate sekali, bukan secret) — standar UUID v5.
const NAMESPACE = 'f97e2b3a-6d2e-4f2a-9d0a-1c2b3e4f5a6b';

function namespaceBytes() {
  return Buffer.from(NAMESPACE.replace(/-/g, ''), 'hex');
}

export function deriveEventId(seed) {
  const hash = crypto.createHash('sha1');
  hash.update(namespaceBytes());
  hash.update(String(seed));
  const bytes = hash.digest().subarray(0, 16);

  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant

  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
