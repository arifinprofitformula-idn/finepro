// api/services/aiCredits.js
// Kredit AI akumulatif khusus paket Lifetime — 4 saldo terpisah per
// fitur (bukan satu pool tertimbang), tidak reset periodik. Dipakai
// oleh api/services/aiUsage.js saat household berstatus plan='lifetime'.

import pool from '../db.js';
import { getSetting } from './appSettings.js';

export const CREDIT_FEATURES = ['receipt_scan', 'ai_insight', 'telegram_chat', 'whatsapp_chat'];

export async function getCreditBalances(householdId) {
  const result = await pool.query(
    `SELECT feature, balance, granted_total FROM ai_credits WHERE household_id = $1`,
    [householdId]
  );
  const byFeature = Object.fromEntries(result.rows.map((r) => [r.feature, { balance: r.balance, granted_total: r.granted_total }]));
  for (const feature of CREDIT_FEATURES) {
    if (!byFeature[feature]) byFeature[feature] = { balance: 0, granted_total: 0 };
  }
  return byFeature;
}

async function getFeatureCredit(client, householdId, feature) {
  const result = await client.query(
    `SELECT balance, granted_total FROM ai_credits WHERE household_id = $1 AND feature = $2`,
    [householdId, feature]
  );
  return result.rows[0] || { balance: 0, granted_total: 0 };
}

// Dipanggil sekali saat pembayaran plan='lifetime' pertama kali berstatus paid.
// Idempotent: no-op kalau household sudah pernah dapat grant_initial.
// externalClient: kalau diteruskan (mis. dari applyPaymentStatus di payments.js), grant
// ikut transaksi pemanggil (atomik dengan update subscriptions) — kalau tidak, fungsi ini
// mengelola transaksinya sendiri.
export async function grantInitialAiCredit(householdId, externalClient = null) {
  const client = externalClient || (await pool.connect());
  const manageTransaction = !externalClient;
  try {
    if (manageTransaction) await client.query('BEGIN');

    const existing = await client.query(
      `SELECT 1 FROM ai_credit_transactions WHERE household_id = $1 AND type = 'grant_initial' LIMIT 1`,
      [householdId]
    );
    if (existing.rows.length > 0) {
      if (manageTransaction) await client.query('ROLLBACK');
      return;
    }

    const aiCredit = await getSetting('ai_credit');
    for (const feature of CREDIT_FEATURES) {
      const amount = Number(aiCredit.lifetime_grant?.[feature] || 0);
      await client.query(
        `INSERT INTO ai_credits (household_id, feature, balance, granted_total)
         VALUES ($1, $2, $3, $3)
         ON CONFLICT (household_id, feature) DO UPDATE
           SET balance = ai_credits.balance + EXCLUDED.balance,
               granted_total = ai_credits.granted_total + EXCLUDED.granted_total,
               updated_at = now()`,
        [householdId, feature, amount]
      );
      await client.query(
        `INSERT INTO ai_credit_transactions (household_id, feature, type, amount)
         VALUES ($1, $2, 'grant_initial', $3)`,
        [householdId, feature, amount]
      );
    }

    if (manageTransaction) await client.query('COMMIT');
  } catch (err) {
    if (manageTransaction) await client.query('ROLLBACK');
    throw err;
  } finally {
    if (manageTransaction) client.release();
  }
}

export async function applyTopupCredit(householdId, orderId, externalClient = null) {
  const client = externalClient || (await pool.connect());
  const manageTransaction = !externalClient;
  try {
    if (manageTransaction) await client.query('BEGIN');

    const aiCredit = await getSetting('ai_credit');
    for (const feature of CREDIT_FEATURES) {
      const amount = Number(aiCredit.topup_grant?.[feature] || 0);
      await client.query(
        `INSERT INTO ai_credits (household_id, feature, balance, granted_total)
         VALUES ($1, $2, $3, $3)
         ON CONFLICT (household_id, feature) DO UPDATE
           SET balance = ai_credits.balance + EXCLUDED.balance,
               granted_total = ai_credits.granted_total + EXCLUDED.granted_total,
               updated_at = now()`,
        [householdId, feature, amount]
      );
      await client.query(
        `INSERT INTO ai_credit_transactions (household_id, feature, type, amount, payment_order_id)
         VALUES ($1, $2, 'topup', $3, $4)`,
        [householdId, feature, amount, orderId]
      );
    }

    if (manageTransaction) await client.query('COMMIT');
  } catch (err) {
    if (manageTransaction) await client.query('ROLLBACK');
    throw err;
  } finally {
    if (manageTransaction) client.release();
  }
}

// Status kuota kredit dalam bentuk yang sama dengan getQuotaStatus() periodik,
// supaya konsumen existing (mis. badge "X/Y kuota" di TransactionModal) tetap jalan.
export async function getCreditQuotaStatus(householdId, feature) {
  const { balance, granted_total: grantedTotal } = await getFeatureCredit(pool, householdId, feature);
  return {
    feature,
    tier: 'lifetime',
    family: 'lifetime',
    scope: 'credit',
    limit: grantedTotal,
    used: grantedTotal - balance,
    remaining: balance,
    allowed: balance > 0,
  };
}

export async function assertCreditAvailable(householdId, feature, label) {
  const status = await getCreditQuotaStatus(householdId, feature);
  if (!status.allowed) {
    const error = new Error(`${label} kredit AI Anda sudah habis. Silakan lakukan Top-Up Kredit AI untuk melanjutkan.`);
    error.status = 429;
    error.creditExhausted = true;
    error.quota = status;
    throw error;
  }
  return status;
}

// Dipanggil di dalam transaksi yang sama dengan insert ai_usage_events (client wajib diteruskan).
export async function debitCredit(client, householdId, feature, aiUsageEventId = null) {
  const result = await client.query(
    `UPDATE ai_credits SET balance = balance - 1, updated_at = now()
     WHERE household_id = $1 AND feature = $2 AND balance > 0
     RETURNING balance`,
    [householdId, feature]
  );
  if (result.rows.length === 0) {
    const error = new Error('Kredit AI habis. Silakan lakukan Top-Up Kredit AI untuk melanjutkan.');
    error.status = 429;
    error.creditExhausted = true;
    throw error;
  }

  await client.query(
    `INSERT INTO ai_credit_transactions (household_id, feature, type, amount, ai_usage_event_id)
     VALUES ($1, $2, 'debit', -1, $3)`,
    [householdId, feature, aiUsageEventId]
  );

  return result.rows[0].balance;
}
