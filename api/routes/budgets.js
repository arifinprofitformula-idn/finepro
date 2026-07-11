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

// GET /api/budgets
router.get('/', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.json({ budgets: [] });

    const result = await pool.query(
      'SELECT category, amount, updated_at FROM budgets WHERE household_id = $1 ORDER BY category',
      [householdId]
    );
    res.json({ budgets: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil budget' });
  }
});

// PUT /api/budgets — upsert budget
router.put('/', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.status(400).json({ error: 'Belum punya household' });

    const { category, amount } = req.body;
    if (!category) return res.status(400).json({ error: 'category wajib diisi' });

    await pool.query(
      `INSERT INTO budgets (household_id, category, amount)
       VALUES ($1, $2, $3)
       ON CONFLICT (household_id, category)
       DO UPDATE SET amount = $3, updated_at = now()`,
      [householdId, category, amount || 0]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Upsert budget error:', err);
    res.status(500).json({ error: 'Gagal menyimpan budget' });
  }
});

// DELETE /api/budgets/:category
router.delete('/:category', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    await pool.query(
      'DELETE FROM budgets WHERE household_id = $1 AND category = $2',
      [householdId, req.params.category]
    );
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus budget' });
  }
});

export default router;
