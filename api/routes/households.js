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

// GET /api/households — dapatkan household user (termasuk status langganan)
router.get('/', async (req, res) => {
  try {
    // Auto-expire: kalau current_period_end sudah lewat tapi status masih
    // 'active' (trial atau plan berbayar), tandai 'expired' di sini —
    // dicek tiap kali data household dibaca, bukan lewat cron terpisah.
    await pool.query(
      `UPDATE subscriptions s
       SET status = 'expired', updated_at = now()
       FROM household_members hm
       WHERE hm.household_id = s.household_id
         AND hm.user_id = $1
         AND s.status = 'active'
         AND s.current_period_end IS NOT NULL
         AND s.current_period_end < CURRENT_DATE`,
      [req.user.userId]
    );

    const result = await pool.query(
      `SELECT h.*, hm.role, s.plan, s.status as subscription_status, s.current_period_end
       FROM households h
       JOIN household_members hm ON h.id = hm.household_id
       LEFT JOIN subscriptions s ON s.household_id = h.id
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

// GET /api/households/me/backup — arsip JSON penuh household yang sedang
// login (transaksi, wallet+transfer, budget, tagihan, kategori, arisan).
// TIDAK menerima filter apapun — household_id selalu diturunkan dari sesi
// JWT (getUserHouseholdId), bukan dari parameter, supaya tidak bisa dipakai
// mengunduh data household lain.
router.get('/me/backup', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.status(404).json({ error: 'Household tidak ditemukan' });

    const [household, transactions, wallets, walletTransfers, budgets, bills, categories, arisanGroups, arisanParticipants, arisanPayments] =
      await Promise.all([
        pool.query('SELECT * FROM households WHERE id = $1', [householdId]),
        pool.query(
          `SELECT id, to_char(date, 'YYYY-MM-DD') as date, type, category, amount, note, wallet_id, created_by, created_at
           FROM transactions WHERE household_id = $1 ORDER BY date, created_at`,
          [householdId]
        ),
        pool.query('SELECT id, name, is_default, created_at FROM wallets WHERE household_id = $1 ORDER BY created_at', [householdId]),
        pool.query(
          'SELECT id, from_wallet_id, to_wallet_id, amount, note, created_by, created_at FROM wallet_transfers WHERE household_id = $1 ORDER BY created_at',
          [householdId]
        ),
        pool.query('SELECT category, amount, updated_at FROM budgets WHERE household_id = $1 ORDER BY category', [householdId]),
        pool.query(
          `SELECT id, name, amount, to_char(due_date, 'YYYY-MM-DD') as due_date, is_recurring, category, paid_at, created_at
           FROM bills WHERE household_id = $1 ORDER BY due_date`,
          [householdId]
        ),
        pool.query('SELECT id, type, name, sort_order, is_default FROM categories WHERE household_id = $1 ORDER BY type, sort_order', [householdId]),
        pool.query('SELECT id, name, amount_per_period, frequency_label, created_at FROM arisan_groups WHERE household_id = $1', [householdId]),
        pool.query(
          `SELECT p.id, p.group_id, p.participant_name, p.turn_order, p.created_at
           FROM arisan_participants p JOIN arisan_groups g ON g.id = p.group_id WHERE g.household_id = $1`,
          [householdId]
        ),
        pool.query(
          `SELECT pay.id, pay.group_id, pay.participant_id, pay.period_label, pay.paid, pay.paid_date
           FROM arisan_payments pay JOIN arisan_groups g ON g.id = pay.group_id WHERE g.household_id = $1`,
          [householdId]
        )
      ]);

    const backup = {
      generated_at: new Date().toISOString(),
      household: household.rows[0] || null,
      transactions: transactions.rows,
      wallets: wallets.rows,
      wallet_transfers: walletTransfers.rows,
      budgets: budgets.rows,
      bills: bills.rows,
      categories: categories.rows,
      arisan_groups: arisanGroups.rows,
      arisan_participants: arisanParticipants.rows,
      arisan_payments: arisanPayments.rows
    };

    const dateSuffix = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="cadangan-keuangan-${dateSuffix}.json"`);
    res.send(JSON.stringify(backup, null, 2));
  } catch (err) {
    console.error('Backup household error:', err);
    res.status(500).json({ error: 'Gagal membuat cadangan data' });
  }
});

export default router;
