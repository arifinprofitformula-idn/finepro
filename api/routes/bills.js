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

// GET /api/bills — daftar tagihan household, urut tanggal jatuh tempo terdekat
router.get('/', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.json({ bills: [] });

    const result = await pool.query(
      `SELECT id, name, amount, to_char(due_date, 'YYYY-MM-DD') as due_date, is_recurring, paid_at, created_at
       FROM bills
       WHERE household_id = $1
       ORDER BY due_date ASC`,
      [householdId]
    );
    res.json({ bills: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil tagihan' });
  }
});

// POST /api/bills — tambah tagihan baru
router.post('/', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.status(400).json({ error: 'Belum punya household' });

    const { name, amount, due_date, is_recurring } = req.body;
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
      `INSERT INTO bills (household_id, name, amount, due_date, is_recurring, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, amount, to_char(due_date, 'YYYY-MM-DD') as due_date, is_recurring, paid_at, created_by, created_at`,
      [householdId, name.trim(), numAmount, due_date, !!is_recurring, req.user.userId]
    );
    res.status(201).json({ bill: result.rows[0] });
  } catch (err) {
    console.error('Create bill error:', err);
    res.status(500).json({ error: 'Gagal menambah tagihan' });
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

    const returning = `id, name, amount, to_char(due_date, 'YYYY-MM-DD') as due_date, is_recurring, paid_at, created_by, created_at`;
    let result;
    if (bill.is_recurring) {
      result = await pool.query(
        `UPDATE bills SET due_date = due_date + interval '1 month', paid_at = NULL WHERE id = $1 RETURNING ${returning}`,
        [bill.id]
      );
    } else {
      result = await pool.query(
        `UPDATE bills SET paid_at = now() WHERE id = $1 RETURNING ${returning}`,
        [bill.id]
      );
    }
    res.json({ bill: result.rows[0] });
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
