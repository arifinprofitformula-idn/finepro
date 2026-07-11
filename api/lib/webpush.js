// api/lib/webpush.js
// Helper kirim push notification budget — dipanggil dari api/routes/transactions.js
// setelah insert transaksi expense berhasil, kalau baru saja melewati
// threshold 80%/100% budget kategori tsb (deteksi stateless, before/after,
// tidak perlu tabel dedupe terpisah).

import webpush from 'web-push';
import pool from '../db.js';

let configured = false;

function ensureConfigured() {
  if (configured) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

// Kirim notifikasi ke semua anggota household yang sudah subscribe.
export async function notifyHousehold(householdId, payload) {
  if (!ensureConfigured()) return;

  try {
    const result = await pool.query(
      `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth
       FROM push_subscriptions ps
       JOIN household_members hm ON hm.user_id = ps.user_id
       WHERE hm.household_id = $1`,
      [householdId]
    );

    for (const sub of result.rows) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      };
      try {
        await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
      } catch (err) {
        // Subscription kadaluarsa/dicabut user — bersihkan supaya tidak dicoba terus
        if (err.statusCode === 404 || err.statusCode === 410) {
          await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
        } else {
          console.error('Push send error:', err.message);
        }
      }
    }
  } catch (err) {
    console.error('notifyHousehold error:', err);
  }
}

// Deteksi "baru saja melewati" threshold 80%/100% dari before/after pct —
// stateless, tidak spam tiap transaksi, hanya sekali saat garis dilewati.
export function crossedThreshold(pctBefore, pctAfter) {
  if (pctBefore < 100 && pctAfter >= 100) return 100;
  if (pctBefore < 80 && pctAfter >= 80) return 80;
  return null;
}
