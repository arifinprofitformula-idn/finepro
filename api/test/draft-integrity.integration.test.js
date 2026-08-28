import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import pool from '../db.js';
import { confirmDraft, cancelAlternativeDrafts } from '../services/transactionImageAnalysisService.js';

const enabled = process.env.FINEPRO_DB_INTEGRATION === '1';

async function createFixture({ amount = 123456789, merchantPrefix = 'QA-DRAFT' } = {}) {
  const member = await pool.query(`
    SELECT hm.household_id, hm.user_id
    FROM household_members hm
    JOIN wallets w ON w.household_id = hm.household_id
    ORDER BY hm.joined_at ASC
    LIMIT 1
  `);
  assert.equal(member.rowCount, 1, 'production-like fixture needs one household member');

  const { household_id: householdId, user_id: userId } = member.rows[0];
  const fingerprint = crypto.randomBytes(24).toString('hex');
  const merchant = `${merchantPrefix}-${fingerprint.slice(0, 12)}`;
  const inserted = await pool.query(`
    INSERT INTO transaction_analysis_drafts
      (household_id, user_id, source_channel, transaction_fingerprint, status, analysis, expires_at)
    VALUES ($1, $2, 'web', $3, 'pending', $4::jsonb, now() + interval '1 hour')
    RETURNING id
  `, [householdId, userId, fingerprint, JSON.stringify({
    amount,
    transaction_date: '2026-08-28',
    transaction_type: 'expense',
    category: 'Lainnya',
    merchant,
    description: merchant,
    overall_confidence: 0.99,
    needs_confirmation: false,
  })]);

  return { draftId: inserted.rows[0].id, householdId, userId, merchant };
}

async function cleanupFixture(fixture) {
  await pool.query(`DELETE FROM transaction_analysis_feedback WHERE draft_id = $1`, [fixture.draftId]);
  await pool.query(`DELETE FROM transactions WHERE household_id = $1 AND created_by = $2 AND note = $3`, [fixture.householdId, fixture.userId, fixture.merchant]);
  await pool.query(`DELETE FROM transaction_analysis_drafts WHERE id = $1`, [fixture.draftId]);
}

test('concurrent confirmation creates exactly one linked transaction', { skip: !enabled }, async () => {
  const fixture = await createFixture();
  const originalQuery = pool.query.bind(pool);
  const contenders = 8;
  let pendingReads = 0;
  let releaseReads;
  const allReadPending = new Promise((resolve) => { releaseReads = resolve; });

  pool.query = async (...args) => {
    const result = await originalQuery(...args);
    const sql = String(args[0] || '');
    if (sql.includes("transaction_analysis_drafts") && sql.includes("status = 'pending'") && sql.includes('SELECT *')) {
      pendingReads += 1;
      if (pendingReads === contenders) releaseReads();
      await allReadPending;
    }
    return result;
  };

  try {
    const results = await Promise.all(Array.from({ length: contenders }, () =>
      confirmDraft(fixture.draftId, fixture.userId, fixture.householdId)
    ));

    const txIds = new Set(results.map((result) => result.transaction.id));
    assert.equal(txIds.size, 1, 'every retry must return same transaction');

    const state = await pool.query(`
      SELECT d.status, d.confirmed_transaction_id,
             count(t.id)::int AS transaction_count
      FROM transaction_analysis_drafts d
      LEFT JOIN transactions t
        ON t.household_id = d.household_id
       AND t.created_by = d.user_id
       AND t.note = $2
      WHERE d.id = $1
      GROUP BY d.status, d.confirmed_transaction_id
    `, [fixture.draftId, fixture.merchant]);

    assert.equal(state.rows[0].status, 'confirmed');
    assert.equal(state.rows[0].transaction_count, 1);
    assert.equal(state.rows[0].confirmed_transaction_id, [...txIds][0]);
  } finally {
    pool.query = originalQuery;
    await cleanupFixture(fixture);
  }
});

test('selecting one multi-analysis candidate cancels every alternative draft', { skip: !enabled }, async () => {
  const selected = await createFixture({ amount: 223344551, merchantPrefix: 'QA-SELECTED' });
  const alternative = await createFixture({ amount: 223344552, merchantPrefix: 'QA-ALTERNATIVE' });
  assert.equal(selected.householdId, alternative.householdId);
  assert.equal(selected.userId, alternative.userId);

  try {
    const count = await cancelAlternativeDrafts(
      [selected.draftId, alternative.draftId],
      selected.draftId,
      selected.userId,
      selected.householdId
    );
    assert.equal(count, 1);

    const states = await pool.query(
      `SELECT id, status FROM transaction_analysis_drafts WHERE id = ANY($1::uuid[]) ORDER BY id`,
      [[selected.draftId, alternative.draftId]]
    );
    const byId = Object.fromEntries(states.rows.map((row) => [row.id, row.status]));
    assert.equal(byId[selected.draftId], 'pending');
    assert.equal(byId[alternative.draftId], 'cancelled');
  } finally {
    await cleanupFixture(selected);
    await cleanupFixture(alternative);
  }
});

test.after(async () => {
  await pool.end();
});
