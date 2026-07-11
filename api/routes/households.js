import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// Helper: dapatkan household_id user (ambil household pertama tempat user jadi member)
async function getUserHouseholdId(userId) {
  const result = await pool.query(
    'SELECT household_id FROM household_members WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  return result.rows[0]?.household_id || null;
}

// GET /api/households — dapatkan household user
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT h.*, hm.role FROM households h
       JOIN household_members hm ON h.id = hm.household_id
       WHERE hm.user_id = $1`,
      [req.user.userId]
    );
    res.json({ households: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data household' });
  }
});

// POST /api/households — buat household baru
router.post('/', async (req, res) => {
  try {
    const { name, household_type } = req.body;
    const type = household_type || 'family';

    const result = await pool.query(
      'INSERT INTO households (name, owner_id, household_type) VALUES ($1, $2, $3) RETURNING *',
      [name || 'Keluarga Saya', req.user.userId, type]
    );

    res.status(201).json({ household: result.rows[0] });
  } catch (err) {
    console.error('Create household error:', err);
    res.status(500).json({ error: 'Gagal membuat household' });
  }
});

export default router;
