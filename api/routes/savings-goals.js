import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const GOAL_TYPES = new Set(['money', 'gold', 'silver']);
const STATUSES = new Set(['active', 'completed', 'archived']);

function isSchemaMissingError(err) {
  return ['42P01', '42703'].includes(err?.code);
}

function sendSavingsGoalError(res, err, fallbackMessage) {
  if (isSchemaMissingError(err)) {
    return res.status(500).json({
      error: 'Struktur database target tabungan belum tersedia. Jalankan migration 024_savings_goals.sql terlebih dahulu.',
    });
  }
  return res.status(500).json({ error: fallbackMessage });
}

async function getUserHouseholdId(userId) {
  const result = await pool.query(
    'SELECT household_id FROM household_members WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  return result.rows[0]?.household_id || null;
}

function toPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function toNonNegativeNumber(value) {
  if (value == null || value === '') return 0;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function validateGoalPayload(body) {
  const name = String(body.name || '').trim();
  const goalType = body.goal_type || 'money';
  const targetAmount = toPositiveNumber(body.target_amount);
  const targetWeight = toPositiveNumber(body.target_weight);
  const targetDate = body.target_date || null;

  if (!name) return { error: 'Nama target wajib diisi' };
  if (!GOAL_TYPES.has(goalType)) return { error: 'Jenis target tidak valid' };
  if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return { error: 'Tanggal target wajib format YYYY-MM-DD' };
  }
  if (goalType === 'money' && !targetAmount) {
    return { error: 'Target Rupiah wajib lebih dari 0' };
  }
  if (goalType !== 'money' && !targetWeight) {
    return { error: 'Target berat wajib lebih dari 0 gram' };
  }

  return {
    value: {
      name,
      goalType,
      targetAmount: goalType === 'money' ? targetAmount : null,
      targetWeight: goalType === 'money' ? null : targetWeight,
      targetDate,
      walletId: body.wallet_id || null,
    },
  };
}

const GOAL_SELECT = `
  SELECT
    g.id,
    g.name,
    g.goal_type,
    g.target_amount,
    g.target_weight,
    to_char(g.target_date, 'YYYY-MM-DD') as target_date,
    g.wallet_id,
    g.status,
    g.created_by,
    g.created_at,
    g.updated_at,
    COALESCE(SUM(c.amount_paid), 0) as total_amount_paid,
    COALESCE(SUM(c.weight), 0) as total_weight,
    COUNT(c.id)::int as contribution_count,
    CASE
      WHEN g.goal_type = 'money' AND g.target_amount > 0
        THEN LEAST(100, ROUND((COALESCE(SUM(c.amount_paid), 0) / g.target_amount) * 100))
      WHEN g.goal_type <> 'money' AND g.target_weight > 0
        THEN LEAST(100, ROUND((COALESCE(SUM(c.weight), 0) / g.target_weight) * 100))
      ELSE 0
    END as progress_percent
  FROM savings_goals g
  LEFT JOIN savings_goal_contributions c ON c.goal_id = g.id
`;

// GET /api/savings-goals
router.get('/', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.json({ goals: [] });

    const status = req.query.status || 'active';
    const where = ['g.household_id = $1'];
    const params = [householdId];
    if (status !== 'all') {
      if (!STATUSES.has(status)) return res.status(400).json({ error: 'Status target tidak valid' });
      params.push(status);
      where.push(`g.status = $${params.length}`);
    }

    const result = await pool.query(
      `${GOAL_SELECT}
       WHERE ${where.join(' AND ')}
       GROUP BY g.id
       ORDER BY
        CASE g.status WHEN 'active' THEN 0 WHEN 'completed' THEN 1 ELSE 2 END,
        g.created_at DESC`,
      params
    );
    res.json({ goals: result.rows });
  } catch (err) {
    console.error('List savings goals error:', err);
    sendSavingsGoalError(res, err, 'Gagal mengambil target tabungan');
  }
});

// POST /api/savings-goals
router.post('/', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.status(400).json({ error: 'Belum punya household' });

    const parsed = validateGoalPayload(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const payload = parsed.value;

    if (payload.walletId) {
      const wallet = await pool.query('SELECT id FROM wallets WHERE id = $1 AND household_id = $2', [payload.walletId, householdId]);
      if (wallet.rows.length === 0) return res.status(400).json({ error: 'Dompet tidak ditemukan' });
    }

    const result = await pool.query(
      `INSERT INTO savings_goals
        (household_id, created_by, name, goal_type, target_amount, target_weight, target_date, wallet_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        householdId,
        req.user.userId,
        payload.name,
        payload.goalType,
        payload.targetAmount,
        payload.targetWeight,
        payload.targetDate,
        payload.walletId,
      ]
    );

    const created = await pool.query(
      `${GOAL_SELECT} WHERE g.id = $1 AND g.household_id = $2 GROUP BY g.id`,
      [result.rows[0].id, householdId]
    );
    res.status(201).json({ goal: created.rows[0] });
  } catch (err) {
    console.error('Create savings goal error:', err);
    sendSavingsGoalError(res, err, 'Gagal membuat target tabungan');
  }
});

// PATCH /api/savings-goals/:id
router.patch('/:id', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.status(400).json({ error: 'Belum punya household' });

    const existing = await pool.query(
      'SELECT id FROM savings_goals WHERE id = $1 AND household_id = $2',
      [req.params.id, householdId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Target tidak ditemukan' });

    const parsed = validateGoalPayload(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const status = req.body.status || 'active';
    if (!STATUSES.has(status)) return res.status(400).json({ error: 'Status target tidak valid' });
    const payload = parsed.value;

    if (payload.walletId) {
      const wallet = await pool.query('SELECT id FROM wallets WHERE id = $1 AND household_id = $2', [payload.walletId, householdId]);
      if (wallet.rows.length === 0) return res.status(400).json({ error: 'Dompet tidak ditemukan' });
    }

    const result = await pool.query(
      `UPDATE savings_goals
       SET name = $1, goal_type = $2, target_amount = $3, target_weight = $4,
           target_date = $5, wallet_id = $6, status = $7, updated_at = now()
       WHERE id = $8 AND household_id = $9
       RETURNING id`,
      [
        payload.name,
        payload.goalType,
        payload.targetAmount,
        payload.targetWeight,
        payload.targetDate,
        payload.walletId,
        status,
        req.params.id,
        householdId,
      ]
    );

    const updated = await pool.query(
      `${GOAL_SELECT} WHERE g.id = $1 AND g.household_id = $2 GROUP BY g.id`,
      [result.rows[0].id, householdId]
    );
    res.json({ goal: updated.rows[0] });
  } catch (err) {
    console.error('Update savings goal error:', err);
    sendSavingsGoalError(res, err, 'Gagal mengubah target tabungan');
  }
});

// POST /api/savings-goals/:id/contributions
router.post('/:id/contributions', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.status(400).json({ error: 'Belum punya household' });

    const goalResult = await pool.query(
      'SELECT id, goal_type FROM savings_goals WHERE id = $1 AND household_id = $2 AND status <> $3',
      [req.params.id, householdId, 'archived']
    );
    if (goalResult.rows.length === 0) return res.status(404).json({ error: 'Target tidak ditemukan' });

    const goal = goalResult.rows[0];
    const date = req.body.date || new Date().toISOString().slice(0, 10);
    const amountPaid = toNonNegativeNumber(req.body.amount_paid);
    const weight = toNonNegativeNumber(req.body.weight);
    const hasPricePerUnit = req.body.price_per_unit != null && req.body.price_per_unit !== '';
    const pricePerUnit = hasPricePerUnit ? toNonNegativeNumber(req.body.price_per_unit) : null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Tanggal kontribusi wajib format YYYY-MM-DD' });
    }
    if (amountPaid == null || weight == null || (hasPricePerUnit && pricePerUnit == null)) {
      return res.status(400).json({ error: 'Nominal atau berat tidak valid' });
    }
    if (goal.goal_type === 'money' && amountPaid <= 0) {
      return res.status(400).json({ error: 'Nominal setoran wajib lebih dari 0' });
    }
    if (goal.goal_type !== 'money' && weight <= 0) {
      return res.status(400).json({ error: 'Berat aset wajib lebih dari 0 gram' });
    }

    await pool.query(
      `INSERT INTO savings_goal_contributions
        (goal_id, created_by, date, amount_paid, weight, price_per_unit, note, transaction_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        req.params.id,
        req.user.userId,
        date,
        amountPaid,
        weight,
        pricePerUnit,
        req.body.note ? String(req.body.note).trim() : null,
        req.body.transaction_id || null,
      ]
    );

    const refreshed = await pool.query(
      `${GOAL_SELECT} WHERE g.id = $1 AND g.household_id = $2 GROUP BY g.id`,
      [req.params.id, householdId]
    );
    res.status(201).json({ goal: refreshed.rows[0] });
  } catch (err) {
    console.error('Create savings contribution error:', err);
    sendSavingsGoalError(res, err, 'Gagal menambah setoran target');
  }
});

// DELETE /api/savings-goals/:id — arsipkan agar histori kontribusi tetap utuh.
router.delete('/:id', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    const result = await pool.query(
      `UPDATE savings_goals SET status = 'archived', updated_at = now()
       WHERE id = $1 AND household_id = $2 RETURNING id`,
      [req.params.id, householdId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Target tidak ditemukan' });
    res.json({ archived: true });
  } catch (err) {
    sendSavingsGoalError(res, err, 'Gagal mengarsipkan target tabungan');
  }
});

export default router;
