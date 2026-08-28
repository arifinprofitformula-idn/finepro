import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pool from '../db.js';
import {
  reconcileWalletBalance,
  reverseWalletReconciliation,
  getWalletBalance,
} from '../services/walletReconciliationService.js';

const enabled = process.env.FINEPRO_DB_INTEGRATION === '1';

async function fixture() {
  const owner = await pool.query(`
    SELECT hm.household_id, hm.user_id
    FROM household_members hm
    WHERE hm.role = 'owner'
    ORDER BY hm.joined_at LIMIT 1
  `);
  assert.equal(owner.rowCount, 1);
  const { household_id: householdId, user_id: userId } = owner.rows[0];
  const wallet = await pool.query(
    `INSERT INTO wallets (household_id, name, is_default)
     VALUES ($1, $2, false) RETURNING id`,
    [householdId, `QA-CAL-${crypto.randomUUID().slice(0, 8)}`]
  );
  return { householdId, userId, walletId: wallet.rows[0].id };
}

async function cleanup(f) {
  await pool.query('DELETE FROM wallets WHERE id = $1', [f.walletId]);
}

test('calibration makes wallet balance equal actual balance without creating transaction', { skip: !enabled }, async () => {
  const f = await fixture();
  const key = crypto.randomUUID();
  try {
    const txBefore = await pool.query('SELECT count(*)::int count FROM transactions');
    const result = await reconcileWalletBalance({
      ...f,
      actualBalance: 725000,
      reason: 'missing_history',
      note: 'QA integration',
      idempotencyKey: key,
    });
    assert.equal(result.balanceBefore, 0);
    assert.equal(result.adjustmentAmount, 725000);
    assert.equal(result.balanceAfter, 725000);
    assert.equal(await getWalletBalance(f.walletId, f.householdId), 725000);
    const txAfter = await pool.query('SELECT count(*)::int count FROM transactions');
    assert.equal(txAfter.rows[0].count, txBefore.rows[0].count);
  } finally { await cleanup(f); }
});

test('same idempotency key returns same reconciliation once', { skip: !enabled }, async () => {
  const f = await fixture();
  const key = crypto.randomUUID();
  try {
    const input = { ...f, actualBalance: 100000, reason: 'unknown_activity', note: '', idempotencyKey: key };
    const [a, b] = await Promise.all([reconcileWalletBalance(input), reconcileWalletBalance(input)]);
    assert.equal(a.id, b.id);
    const count = await pool.query('SELECT count(*)::int count FROM wallet_reconciliations WHERE wallet_id = $1', [f.walletId]);
    assert.equal(count.rows[0].count, 1);
  } finally { await cleanup(f); }
});

test('household member cannot calibrate shared wallet', { skip: !enabled }, async (t) => {
  const member = await pool.query(`
    SELECT hm.household_id, hm.user_id
    FROM household_members hm WHERE hm.role = 'member' LIMIT 1
  `);
  if (!member.rowCount) return t.skip('no member fixture');
  const wallet = await pool.query('SELECT id FROM wallets WHERE household_id = $1 LIMIT 1', [member.rows[0].household_id]);
  if (!wallet.rowCount) return t.skip('member household has no wallet');
  await assert.rejects(
    reconcileWalletBalance({
      householdId: member.rows[0].household_id,
      userId: member.rows[0].user_id,
      walletId: wallet.rows[0].id,
      actualBalance: 999999,
      reason: 'other',
      note: 'forbidden QA',
      idempotencyKey: crypto.randomUUID(),
    }),
    (error) => error.code === 'RECONCILIATION_FORBIDDEN'
  );
});

test('reversal restores previous balance and is idempotent', { skip: !enabled }, async () => {
  const f = await fixture();
  try {
    const made = await reconcileWalletBalance({ ...f, actualBalance: 350000, reason: 'missing_history', note: '', idempotencyKey: crypto.randomUUID() });
    const a = await reverseWalletReconciliation({ reconciliationId: made.id, householdId: f.householdId, userId: f.userId });
    const b = await reverseWalletReconciliation({ reconciliationId: made.id, householdId: f.householdId, userId: f.userId });
    assert.equal(a.id, b.id);
    assert.equal(await getWalletBalance(f.walletId, f.householdId), 0);
  } finally { await cleanup(f); }
});

test.after(async () => { await pool.end(); });
