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

// GET /api/transactions — list transaksi bulan ini
router.get('/', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.json({ transactions: [] });

    const { month, year } = req.query;
    let dateFilter = '';
    const params = [householdId];

    if (month && year) {
      dateFilter = 'AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3';
      params.push(month, year);
    }

    const result = await pool.query(
      `SELECT id, date, type, category, amount, note, created_at, created_by
       FROM transactions
       WHERE household_id = $1 ${dateFilter}
       ORDER BY date DESC, created_at DESC
       LIMIT 100`,
      params
    );
    res.json({ transactions: result.rows });
  } catch (err) {
    console.error('List transactions error:', err);
    res.status(500).json({ error: 'Gagal mengambil transaksi' });
  }
});

// POST /api/transactions — tambah transaksi
router.post('/', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.status(400).json({ error: 'Belum punya household' });

    const { date, type, category, amount, note } = req.body;
    if (!date || !type || !category || amount == null) {
      return res.status(400).json({ error: 'date, type, category, amount wajib diisi' });
    }

    const result = await pool.query(
      `INSERT INTO transactions (household_id, created_by, date, type, category, amount, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [householdId, req.user.userId, date, type, category, amount, note || null]
    );
    res.status(201).json({ transaction: result.rows[0] });
  } catch (err) {
    console.error('Create transaction error:', err);
    res.status(500).json({ error: 'Gagal menambah transaksi' });
  }
});

// DELETE /api/transactions/:id — hapus transaksi
router.delete('/:id', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    const result = await pool.query(
      'DELETE FROM transactions WHERE id = $1 AND household_id = $2 RETURNING id',
      [req.params.id, householdId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    }
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus transaksi' });
  }
});

// GET /api/transactions/summary — ringkasan dashboard
router.get('/summary', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.json({ income: 0, expense: 0, balance: 0 });

    const result = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0) as income,
         COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) as expense
       FROM transactions
       WHERE household_id = $1
         AND EXTRACT(MONTH FROM date) = EXTRACT(MONTH FROM CURRENT_DATE)
         AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM CURRENT_DATE)`,
      [householdId]
    );

    const { income, expense } = result.rows[0];
    res.json({
      income: parseFloat(income),
      expense: parseFloat(expense),
      balance: parseFloat(income) - parseFloat(expense)
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil ringkasan' });
  }
});

export default router;
