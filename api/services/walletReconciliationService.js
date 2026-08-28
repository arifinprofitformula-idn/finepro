import crypto from 'crypto';
import pool from '../db.js';

const ALLOWED_REASONS = new Set([
  'missing_history',
  'unknown_activity',
  'opening_balance_error',
  'other',
]);

function asMoney(value, field = 'saldo') {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${field} tidak valid`);
  }
  return Number(number.toFixed(2));
}

async function assertOwner(client, householdId, userId) {
  const membership = await client.query(
    `SELECT role FROM household_members
     WHERE household_id = $1 AND user_id = $2`,
    [householdId, userId]
  );
  if (membership.rows[0]?.role !== 'owner') {
    const error = new Error('Hanya pemilik household yang dapat mengkalibrasi saldo');
    error.code = 'RECONCILIATION_FORBIDDEN';
    throw error;
  }
}

async function calculateWalletBalance(client, walletId, householdId) {
  const result = await client.query(
    `SELECT
       COALESCE((
         SELECT SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END)
         FROM transactions t
         WHERE t.wallet_id = $1 AND t.household_id = $2
       ), 0)
       + COALESCE((SELECT SUM(wt.amount) FROM wallet_transfers wt WHERE wt.to_wallet_id = $1 AND wt.household_id = $2), 0)
       - COALESCE((SELECT SUM(wt.amount) FROM wallet_transfers wt WHERE wt.from_wallet_id = $1 AND wt.household_id = $2), 0)
       + COALESCE((SELECT SUM(wr.adjustment_amount) FROM wallet_reconciliations wr WHERE wr.wallet_id = $1 AND wr.household_id = $2), 0)
       AS balance`,
    [walletId, householdId]
  );
  return Number(result.rows[0].balance);
}

export async function getWalletBalance(walletId, householdId, client = pool) {
  return calculateWalletBalance(client, walletId, householdId);
}

function mapRow(row, alreadyExisted = false) {
  return {
    id: row.id,
    walletId: row.wallet_id,
    actualBalance: Number(row.actual_balance),
    balanceBefore: Number(row.balance_before),
    adjustmentAmount: Number(row.adjustment_amount),
    balanceAfter: Number(row.balance_before) + Number(row.adjustment_amount),
    reason: row.reason,
    note: row.note,
    createdAt: row.created_at,
    reversesId: row.reverses_id,
    reversedById: row.reversed_by_id,
    alreadyExisted,
  };
}

export async function reconcileWalletBalance({
  householdId,
  walletId,
  userId,
  actualBalance,
  reason,
  note = '',
  idempotencyKey,
}) {
  if (!idempotencyKey) throw new Error('Idempotency key wajib diisi');
  if (!ALLOWED_REASONS.has(reason)) throw new Error('Alasan kalibrasi tidak valid');
  const target = asMoney(actualBalance, 'Saldo aktual');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await assertOwner(client, householdId, userId);
    const wallet = await client.query(
      `SELECT id FROM wallets WHERE id = $1 AND household_id = $2 FOR UPDATE`,
      [walletId, householdId]
    );
    if (!wallet.rowCount) throw new Error('Dompet tidak ditemukan');

    const existing = await client.query(
      `SELECT * FROM wallet_reconciliations
       WHERE household_id = $1 AND idempotency_key = $2`,
      [householdId, idempotencyKey]
    );
    if (existing.rowCount) {
      await client.query('COMMIT');
      return mapRow(existing.rows[0], true);
    }

    const before = await calculateWalletBalance(client, walletId, householdId);
    const adjustment = Number((target - before).toFixed(2));
    if (adjustment === 0) {
      const error = new Error('Saldo sudah sesuai, tidak perlu kalibrasi');
      error.code = 'BALANCE_ALREADY_MATCHED';
      throw error;
    }

    const inserted = await client.query(
      `INSERT INTO wallet_reconciliations
       (household_id, wallet_id, created_by, actual_balance, balance_before,
        adjustment_amount, reason, note, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [householdId, walletId, userId, target, before, adjustment, reason, note.trim() || null, idempotencyKey]
    );
    await client.query('COMMIT');
    return mapRow(inserted.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function reverseWalletReconciliation({ reconciliationId, householdId, userId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await assertOwner(client, householdId, userId);
    const originalResult = await client.query(
      `SELECT * FROM wallet_reconciliations
       WHERE id = $1 AND household_id = $2 AND reverses_id IS NULL
       FOR UPDATE`,
      [reconciliationId, householdId]
    );
    if (!originalResult.rowCount) throw new Error('Kalibrasi tidak ditemukan');
    const original = originalResult.rows[0];

    const wallet = await client.query(
      `SELECT id FROM wallets WHERE id = $1 AND household_id = $2 FOR UPDATE`,
      [original.wallet_id, householdId]
    );
    if (!wallet.rowCount) throw new Error('Dompet tidak ditemukan');

    if (original.reversed_by_id) {
      const existing = await client.query('SELECT * FROM wallet_reconciliations WHERE id = $1', [original.reversed_by_id]);
      await client.query('COMMIT');
      return mapRow(existing.rows[0], true);
    }

    const before = await calculateWalletBalance(client, original.wallet_id, householdId);
    const adjustment = -Number(original.adjustment_amount);
    const target = Number((before + adjustment).toFixed(2));
    if (target < 0) throw new Error('Pembatalan membuat saldo negatif');
    const inserted = await client.query(
      `INSERT INTO wallet_reconciliations
       (household_id, wallet_id, created_by, actual_balance, balance_before,
        adjustment_amount, reason, note, idempotency_key, reverses_id)
       VALUES ($1,$2,$3,$4,$5,$6,'other',$7,$8,$9)
       RETURNING *`,
      [householdId, original.wallet_id, userId, target, before, adjustment,
       `Pembatalan kalibrasi ${original.id}`, crypto.randomUUID(), original.id]
    );
    await client.query(
      'UPDATE wallet_reconciliations SET reversed_by_id = $1 WHERE id = $2',
      [inserted.rows[0].id, original.id]
    );
    await client.query('COMMIT');
    return mapRow(inserted.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function listWalletReconciliations(walletId, householdId, limit = 20) {
  const result = await pool.query(
    `SELECT wr.*, u.name AS creator_name, u.email AS creator_email
     FROM wallet_reconciliations wr
     JOIN users u ON u.id = wr.created_by
     WHERE wr.wallet_id = $1 AND wr.household_id = $2
     ORDER BY wr.created_at DESC LIMIT $3`,
    [walletId, householdId, Math.min(Math.max(Number(limit) || 20, 1), 50)]
  );
  return result.rows.map((row) => ({ ...mapRow(row), creatorName: row.creator_name || row.creator_email }));
}
