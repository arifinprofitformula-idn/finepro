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

// GET /api/wallets — daftar wallet + saldo terhitung
// Saldo = income - expense (transaksi milik wallet itu) + transfer masuk - transfer keluar.
// Transfer sengaja TIDAK disimpan di tabel transactions supaya tidak
// memengaruhi total income/expense household.
router.get('/', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.json({ wallets: [] });

    const result = await pool.query(
      `SELECT
         w.id, w.name, w.is_default,
         COALESCE((
           SELECT SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END)
           FROM transactions t WHERE t.wallet_id = w.id
         ), 0)
         + COALESCE((SELECT SUM(amount) FROM wallet_transfers WHERE to_wallet_id = w.id), 0)
         - COALESCE((SELECT SUM(amount) FROM wallet_transfers WHERE from_wallet_id = w.id), 0)
         as balance
       FROM wallets w
       WHERE w.household_id = $1
       ORDER BY w.is_default DESC, w.created_at ASC`,
      [householdId]
    );

    res.json({
      wallets: result.rows.map(w => ({ ...w, balance: parseFloat(w.balance) }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data dompet' });
  }
});

// POST /api/wallets — buat wallet baru
router.post('/', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.status(400).json({ error: 'Belum punya household' });

    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nama dompet wajib diisi' });
    }

    const result = await pool.query(
      `INSERT INTO wallets (household_id, name, is_default) VALUES ($1, $2, false) RETURNING id, name, is_default`,
      [householdId, name.trim()]
    );
    res.status(201).json({ wallet: { ...result.rows[0], balance: 0 } });
  } catch (err) {
    console.error('Create wallet error:', err);
    res.status(500).json({ error: 'Gagal membuat dompet' });
  }
});

// POST /api/wallets/transfer — pindah saldo antar wallet dalam household yang sama
router.post('/transfer', async (req, res) => {
  const client = await pool.connect();
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.status(400).json({ error: 'Belum punya household' });

    const { from_wallet_id, to_wallet_id, amount, note } = req.body;
    const numAmount = Number(amount);
    if (!from_wallet_id || !to_wallet_id || from_wallet_id === to_wallet_id) {
      return res.status(400).json({ error: 'Dompet asal dan tujuan wajib diisi dan berbeda' });
    }
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Nominal transfer tidak valid' });
    }

    await client.query('BEGIN');

    // Pastikan kedua wallet memang milik household user (bukan household lain)
    const walletCheck = await client.query(
      `SELECT id FROM wallets WHERE id = ANY($1::uuid[]) AND household_id = $2`,
      [[from_wallet_id, to_wallet_id], householdId]
    );
    if (walletCheck.rows.length !== 2) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Dompet tidak ditemukan' });
    }

    // Cek saldo cukup
    const balanceResult = await client.query(
      `SELECT
         COALESCE((
           SELECT SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END)
           FROM transactions t WHERE t.wallet_id = $1
         ), 0)
         + COALESCE((SELECT SUM(amount) FROM wallet_transfers WHERE to_wallet_id = $1), 0)
         - COALESCE((SELECT SUM(amount) FROM wallet_transfers WHERE from_wallet_id = $1), 0)
         as balance`,
      [from_wallet_id]
    );
    const currentBalance = parseFloat(balanceResult.rows[0].balance);
    if (currentBalance < numAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Saldo dompet asal tidak cukup' });
    }

    const result = await client.query(
      `INSERT INTO wallet_transfers (household_id, from_wallet_id, to_wallet_id, amount, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [householdId, from_wallet_id, to_wallet_id, numAmount, note || null, req.user.userId]
    );

    await client.query('COMMIT');
    res.status(201).json({ transfer: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Transfer error:', err);
    res.status(500).json({ error: 'Gagal melakukan transfer' });
  } finally {
    client.release();
  }
});

export default router;
