import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

async function getOwnerHouseholdId(userId) {
  const result = await pool.query(
    `SELECT household_id FROM household_members WHERE user_id = $1 AND role = 'owner' LIMIT 1`,
    [userId]
  );
  return result.rows[0]?.household_id || null;
}

// POST /api/invites — owner household mengundang anggota baru lewat email
router.post('/', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email wajib diisi' });
    }

    const householdId = await getOwnerHouseholdId(req.user.userId);
    if (!householdId) {
      return res.status(403).json({ error: 'Hanya pemilik household yang bisa mengundang anggota' });
    }

    const result = await pool.query(
      `INSERT INTO household_invites (household_id, invited_email, invited_by)
       VALUES ($1, $2, $3) RETURNING *`,
      [householdId, email.toLowerCase().trim(), req.user.userId]
    );

    res.status(201).json({ invite: result.rows[0] });
  } catch (err) {
    console.error('Create invite error:', err);
    res.status(500).json({ error: 'Gagal membuat undangan' });
  }
});

// GET /api/invites/mine — undangan pending untuk email user yang sedang login
router.get('/mine', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, h.name as household_name
       FROM household_invites i
       JOIN households h ON h.id = i.household_id
       WHERE lower(i.invited_email) = lower($1)
         AND i.status = 'pending'
         AND i.expires_at > now()
       ORDER BY i.created_at DESC`,
      [req.user.email]
    );
    res.json({ invites: result.rows });
  } catch (err) {
    console.error('List invites error:', err);
    res.status(500).json({ error: 'Gagal mengambil undangan' });
  }
});

// POST /api/invites/:id/accept — terima undangan, gabung ke household
router.post('/:id/accept', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const inviteResult = await client.query(
      `SELECT * FROM household_invites WHERE id = $1 FOR UPDATE`,
      [req.params.id]
    );
    const invite = inviteResult.rows[0];

    if (!invite) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Undangan tidak ditemukan' });
    }
    if (invite.status !== 'pending' || new Date(invite.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Undangan sudah tidak berlaku' });
    }
    if (invite.invited_email.toLowerCase() !== req.user.email.toLowerCase()) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Undangan ini bukan untuk akun Anda' });
    }

    const existing = await client.query(
      `SELECT household_id FROM household_members WHERE user_id = $1 LIMIT 1`,
      [req.user.userId]
    );
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Anda sudah tergabung di household lain' });
    }

    await client.query(
      `INSERT INTO household_members (household_id, user_id, role) VALUES ($1, $2, 'member')`,
      [invite.household_id, req.user.userId]
    );
    await client.query(
      `UPDATE household_invites SET status = 'accepted' WHERE id = $1`,
      [invite.id]
    );

    await client.query('COMMIT');
    res.json({ joined: true, householdId: invite.household_id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Accept invite error:', err);
    res.status(500).json({ error: 'Gagal menerima undangan' });
  } finally {
    client.release();
  }
});

export default router;
