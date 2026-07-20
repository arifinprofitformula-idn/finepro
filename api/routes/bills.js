import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

async function getUserHouseholdId(userId) {
  const result = await pool.query(
    'SELECT household_id FROM household_members WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  return result.rows[0]?.household_id || null;
}

const BILL_COLUMNS = `
  b.id,
  b.name,
  b.amount,
  to_char(b.due_date, 'YYYY-MM-DD') as due_date,
  b.is_recurring,
  b.category,
  b.paid_at,
  b.created_by,
  b.created_at,
  COALESCE((
    SELECT json_agg(statement_row)
    FROM (
      SELECT
        bp.id,
        to_char(bp.due_date, 'YYYY-MM-DD') as due_date,
        to_char(bp.period_month, 'YYYY-MM') as period_month,
        bp.amount,
        bp.paid_at
      FROM bill_payment_statements bp
      WHERE bp.bill_id = b.id
      ORDER BY bp.due_date DESC
      LIMIT 6
    ) statement_row
  ), '[]'::json) as paid_statements`;

// GET /api/bills — daftar tagihan household, urut tanggal jatuh tempo terdekat
router.get('/', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.json({ bills: [] });

    const result = await pool.query(
      `SELECT ${BILL_COLUMNS} FROM bills b WHERE b.household_id = $1 ORDER BY b.due_date ASC`,
      [householdId]
    );
    res.json({ bills: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil tagihan' });
  }
});

// GET /api/bills/upcoming — tagihan belum lunas, jatuh tempo dalam 5 hari ke depan
// (termasuk yang sudah lewat tempo) — dipakai banner pengingat di section Tagihan.
router.get('/upcoming', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.json({ bills: [] });

    const result = await pool.query(
      `SELECT ${BILL_COLUMNS} FROM bills b
       WHERE b.household_id = $1 AND b.paid_at IS NULL AND b.due_date <= CURRENT_DATE + INTERVAL '5 days'
       ORDER BY b.due_date ASC`,
      [householdId]
    );
    res.json({ bills: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil tagihan mendatang' });
  }
});

// POST /api/bills — tambah tagihan baru
router.post('/', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.status(400).json({ error: 'Belum punya household' });

    const { name, amount, due_date, is_recurring, category } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nama tagihan wajib diisi' });
    }
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount < 0) {
      return res.status(400).json({ error: 'Nominal tagihan tidak valid' });
    }
    if (!due_date || !/^\d{4}-\d{2}-\d{2}$/.test(due_date)) {
      return res.status(400).json({ error: 'Tanggal jatuh tempo wajib format YYYY-MM-DD' });
    }

    const result = await pool.query(
      `INSERT INTO bills (household_id, name, amount, due_date, is_recurring, category, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [householdId, name.trim(), numAmount, due_date, !!is_recurring, category || null, req.user.userId]
    );
    const created = await pool.query(`SELECT ${BILL_COLUMNS} FROM bills b WHERE b.id = $1`, [result.rows[0].id]);
    res.status(201).json({ bill: created.rows[0] });
  } catch (err) {
    console.error('Create bill error:', err);
    res.status(500).json({ error: 'Gagal menambah tagihan' });
  }
});

// PATCH /api/bills/:id — ubah data tagihan
router.patch('/:id', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    const existing = await pool.query(
      'SELECT id FROM bills WHERE id = $1 AND household_id = $2',
      [req.params.id, householdId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Tagihan tidak ditemukan' });
    }

    const { name, amount, due_date, is_recurring, category } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nama tagihan wajib diisi' });
    }
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount < 0) {
      return res.status(400).json({ error: 'Nominal tagihan tidak valid' });
    }
    if (!due_date || !/^\d{4}-\d{2}-\d{2}$/.test(due_date)) {
      return res.status(400).json({ error: 'Tanggal jatuh tempo wajib format YYYY-MM-DD' });
    }

    const result = await pool.query(
      `UPDATE bills SET name = $1, amount = $2, due_date = $3, is_recurring = $4, category = $5
       WHERE id = $6 RETURNING id`,
      [name.trim(), numAmount, due_date, !!is_recurring, category || null, req.params.id]
    );
    const updated = await pool.query(`SELECT ${BILL_COLUMNS} FROM bills b WHERE b.id = $1`, [result.rows[0].id]);
    res.json({ bill: updated.rows[0] });
  } catch (err) {
    console.error('Update bill error:', err);
    res.status(500).json({ error: 'Gagal mengubah tagihan' });
  }
});

// POST /api/bills/:id/mark-paid — tandai lunas; kalau berulang, majukan jatuh tempo +1 bulan
router.post('/:id/mark-paid', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    const existing = await pool.query(
      'SELECT * FROM bills WHERE id = $1 AND household_id = $2',
      [req.params.id, householdId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Tagihan tidak ditemukan' });
    }
    const bill = existing.rows[0];

    await pool.query(
      `INSERT INTO bill_payment_statements (bill_id, household_id, due_date, period_month, amount, created_by)
       VALUES ($1, $2, $3, date_trunc('month', $3::date)::date, $4, $5)
       ON CONFLICT (bill_id, due_date)
       DO UPDATE SET amount = EXCLUDED.amount, paid_at = now(), created_by = EXCLUDED.created_by`,
      [bill.id, householdId, bill.due_date, bill.amount, req.user.userId]
    );

    const result = bill.is_recurring
      ? await pool.query(
          `UPDATE bills SET due_date = due_date + interval '1 month', paid_at = NULL WHERE id = $1 RETURNING id`,
          [bill.id]
        )
      : await pool.query(
          `UPDATE bills SET paid_at = now() WHERE id = $1 RETURNING id`,
          [bill.id]
        );

    const updated = await pool.query(`SELECT ${BILL_COLUMNS} FROM bills b WHERE b.id = $1`, [result.rows[0].id]);
    res.json({ bill: updated.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menandai tagihan lunas' });
  }
});

// DELETE /api/bills/:id
router.delete('/:id', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    const result = await pool.query(
      'DELETE FROM bills WHERE id = $1 AND household_id = $2 RETURNING id',
      [req.params.id, householdId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tagihan tidak ditemukan' });
    }
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus tagihan' });
  }
});

export default router;
