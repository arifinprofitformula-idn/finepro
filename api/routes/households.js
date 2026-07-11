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

// PATCH /api/households/me — update pengaturan household milik user yang login
// (saat ini hanya monthly_income_day, khusus household bertipe mahasiswa)
router.patch('/me', async (req, res) => {
  try {
    const { monthly_income_day } = req.body;

    if (monthly_income_day !== null && monthly_income_day !== undefined) {
      const day = Number(monthly_income_day);
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        return res.status(400).json({ error: 'monthly_income_day harus berupa angka 1-31' });
      }
    }

    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) {
      return res.status(404).json({ error: 'Household tidak ditemukan' });
    }

    const householdResult = await pool.query(
      'SELECT household_type FROM households WHERE id = $1',
      [householdId]
    );
    if (householdResult.rows[0]?.household_type !== 'student') {
      return res.status(400).json({ error: 'Fitur ini hanya untuk household bertipe mahasiswa' });
    }

    const result = await pool.query(
      'UPDATE households SET monthly_income_day = $1 WHERE id = $2 RETURNING *',
      [monthly_income_day ?? null, householdId]
    );
    res.json({ household: result.rows[0] });
  } catch (err) {
    console.error('Update household error:', err);
    res.status(500).json({ error: 'Gagal memperbarui household' });
  }
});

export default router;
