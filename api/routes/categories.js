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

// GET /api/categories
router.get('/', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.json({ categories: [] });

    const result = await pool.query(
      'SELECT id, type, name, sort_order, is_default FROM categories WHERE household_id = $1 ORDER BY type, sort_order',
      [householdId]
    );
    res.json({ categories: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil kategori' });
  }
});

export default router;
