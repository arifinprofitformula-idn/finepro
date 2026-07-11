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

// Pastikan grup memang milik household user — dipakai sebelum operasi tulis
async function assertGroupOwnership(groupId, householdId) {
  const result = await pool.query(
    'SELECT id FROM arisan_groups WHERE id = $1 AND household_id = $2',
    [groupId, householdId]
  );
  return result.rows.length > 0;
}

// GET /api/arisan — daftar grup arisan + jumlah peserta
router.get('/', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.json({ groups: [] });

    const result = await pool.query(
      `SELECT g.id, g.name, g.amount_per_period, g.frequency_label, g.created_at,
              COUNT(p.id) as participant_count
       FROM arisan_groups g
       LEFT JOIN arisan_participants p ON p.group_id = g.id
       WHERE g.household_id = $1
       GROUP BY g.id
       ORDER BY g.created_at DESC`,
      [householdId]
    );
    res.json({
      groups: result.rows.map(g => ({ ...g, participant_count: parseInt(g.participant_count, 10) }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data arisan' });
  }
});

// POST /api/arisan — buat grup arisan baru
router.post('/', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.status(400).json({ error: 'Belum punya household' });

    const { name, amount_per_period, frequency_label } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nama arisan wajib diisi' });
    }
    const amount = Number(amount_per_period);
    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ error: 'Nominal iuran tidak valid' });
    }

    const result = await pool.query(
      `INSERT INTO arisan_groups (household_id, name, amount_per_period, frequency_label, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [householdId, name.trim(), amount, (frequency_label || 'Bulanan').trim(), req.user.userId]
    );
    res.status(201).json({ group: { ...result.rows[0], participant_count: 0 } });
  } catch (err) {
    console.error('Create arisan group error:', err);
    res.status(500).json({ error: 'Gagal membuat grup arisan' });
  }
});

// DELETE /api/arisan/:groupId
router.delete('/:groupId', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    const result = await pool.query(
      'DELETE FROM arisan_groups WHERE id = $1 AND household_id = $2 RETURNING id',
      [req.params.groupId, householdId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Grup arisan tidak ditemukan' });
    }
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus grup arisan' });
  }
});

// GET /api/arisan/:groupId — detail grup + peserta + status bayar periode tertentu
router.get('/:groupId', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!(await assertGroupOwnership(req.params.groupId, householdId))) {
      return res.status(404).json({ error: 'Grup arisan tidak ditemukan' });
    }

    const period = req.query.period || new Date().toISOString().slice(0, 7);

    const participants = await pool.query(
      `SELECT p.id, p.participant_name, p.turn_order,
              COALESCE(ap.paid, false) as paid
       FROM arisan_participants p
       LEFT JOIN arisan_payments ap ON ap.participant_id = p.id AND ap.period_label = $2
       WHERE p.group_id = $1
       ORDER BY p.turn_order NULLS LAST, p.created_at ASC`,
      [req.params.groupId, period]
    );

    res.json({ period, participants: participants.rows });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil detail arisan' });
  }
});

// POST /api/arisan/:groupId/participants — tambah peserta (nama bebas, bukan user terdaftar)
router.post('/:groupId/participants', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!(await assertGroupOwnership(req.params.groupId, householdId))) {
      return res.status(404).json({ error: 'Grup arisan tidak ditemukan' });
    }

    const { participant_name } = req.body;
    if (!participant_name || !participant_name.trim()) {
      return res.status(400).json({ error: 'Nama peserta wajib diisi' });
    }

    const result = await pool.query(
      `INSERT INTO arisan_participants (group_id, participant_name) VALUES ($1, $2) RETURNING *`,
      [req.params.groupId, participant_name.trim()]
    );
    res.status(201).json({ participant: { ...result.rows[0], paid: false } });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menambah peserta' });
  }
});

// DELETE /api/arisan/participants/:id
router.delete('/participants/:id', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    const result = await pool.query(
      `DELETE FROM arisan_participants p
       USING arisan_groups g
       WHERE p.id = $1 AND p.group_id = g.id AND g.household_id = $2
       RETURNING p.id`,
      [req.params.id, householdId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Peserta tidak ditemukan' });
    }
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus peserta' });
  }
});

// POST /api/arisan/participants/:id/toggle-paid — toggle status bayar untuk satu periode
router.post('/participants/:id/toggle-paid', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    const { period_label } = req.body;
    if (!period_label) {
      return res.status(400).json({ error: 'period_label wajib diisi' });
    }

    const participantCheck = await pool.query(
      `SELECT p.id FROM arisan_participants p
       JOIN arisan_groups g ON g.id = p.group_id
       WHERE p.id = $1 AND g.household_id = $2`,
      [req.params.id, householdId]
    );
    if (participantCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Peserta tidak ditemukan' });
    }

    const result = await pool.query(
      `INSERT INTO arisan_payments (group_id, participant_id, period_label, paid, paid_date)
       SELECT group_id, $1, $2, true, now() FROM arisan_participants WHERE id = $1
       ON CONFLICT (participant_id, period_label)
       DO UPDATE SET paid = NOT arisan_payments.paid,
                     paid_date = CASE WHEN NOT arisan_payments.paid THEN now() ELSE NULL END
       RETURNING paid`,
      [req.params.id, period_label]
    );
    res.json({ paid: result.rows[0].paid });
  } catch (err) {
    console.error('Toggle arisan payment error:', err);
    res.status(500).json({ error: 'Gagal mengubah status bayar' });
  }
});

export default router;
