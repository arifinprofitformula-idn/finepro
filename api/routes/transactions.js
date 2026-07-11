import { Router } from 'express';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { notifyHousehold, crossedThreshold } from '../lib/webpush.js';

const router = Router();
router.use(authMiddleware);

// Memory storage — foto struk hanya dipakai sesaat untuk ekstraksi, tidak disimpan
const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!/^image\/(png|jpe?g|webp)$/.test(file.mimetype)) {
      return cb(new Error('Format foto harus PNG, JPG, atau WEBP'));
    }
    cb(null, true);
  },
});

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
      `SELECT t.id, to_char(t.date, 'YYYY-MM-DD') as date, t.type, t.category, t.amount, t.note, t.created_at, t.created_by,
              u.name as creator_name, u.email as creator_email
       FROM transactions t
       JOIN users u ON u.id = t.created_by
       WHERE t.household_id = $1 ${dateFilter}
       ORDER BY t.date DESC, t.created_at DESC
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

    const { date, type, category, amount, note, wallet_id } = req.body;
    if (!date || !type || !category || amount == null) {
      return res.status(400).json({ error: 'date, type, category, amount wajib diisi' });
    }

    // wallet_id opsional — kalau tidak dikirim (user tidak peduli multi-dompet),
    // pakai wallet default household supaya saldo tetap konsisten terhitung.
    let walletId = wallet_id || null;
    if (walletId) {
      const walletCheck = await pool.query(
        'SELECT id FROM wallets WHERE id = $1 AND household_id = $2',
        [walletId, householdId]
      );
      if (walletCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Dompet tidak ditemukan' });
      }
    } else {
      const defaultWallet = await pool.query(
        'SELECT id FROM wallets WHERE household_id = $1 AND is_default = true LIMIT 1',
        [householdId]
      );
      walletId = defaultWallet.rows[0]?.id || null;
    }

    const result = await pool.query(
      `INSERT INTO transactions (household_id, created_by, date, type, category, amount, note, wallet_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, to_char(date, 'YYYY-MM-DD') as date, type, category, amount, note, created_at, created_by, wallet_id`,
      [householdId, req.user.userId, date, type, category, amount, note || null, walletId]
    );
    res.status(201).json({ transaction: result.rows[0] });

    // Notifikasi budget — tidak menunda response, jalan setelah dikirim ke client.
    // Hanya untuk expense di kategori berbudget & tanggalnya bulan berjalan.
    if (type === 'expense') {
      checkBudgetThreshold(householdId, category, date, Number(amount)).catch((err) =>
        console.error('Budget threshold check error:', err)
      );
    }
  } catch (err) {
    console.error('Create transaction error:', err);
    res.status(500).json({ error: 'Gagal menambah transaksi' });
  }
});

async function checkBudgetThreshold(householdId, category, date, newAmount) {
  const now = new Date();
  const txDate = new Date(date + 'T00:00:00');
  if (txDate.getFullYear() !== now.getFullYear() || txDate.getMonth() !== now.getMonth()) return;

  const budgetResult = await pool.query(
    'SELECT amount FROM budgets WHERE household_id = $1 AND category = $2',
    [householdId, category]
  );
  const budget = parseFloat(budgetResult.rows[0]?.amount || 0);
  if (budget <= 0) return;

  const spentResult = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) as spent FROM transactions
     WHERE household_id = $1 AND category = $2 AND type = 'expense'
       AND EXTRACT(MONTH FROM date) = EXTRACT(MONTH FROM CURRENT_DATE)
       AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM CURRENT_DATE)`,
    [householdId, category]
  );
  const spentAfter = parseFloat(spentResult.rows[0].spent);
  const spentBefore = spentAfter - newAmount;

  const pctBefore = (spentBefore / budget) * 100;
  const pctAfter = (spentAfter / budget) * 100;
  const threshold = crossedThreshold(pctBefore, pctAfter);
  if (!threshold) return;

  const title = threshold >= 100 ? `Budget "${category}" terlampaui` : `Budget "${category}" hampir habis`;
  const body = threshold >= 100
    ? `Pengeluaran kategori ini sudah melewati budget bulan ini.`
    : `Pengeluaran kategori ini sudah mencapai ${threshold}% dari budget bulan ini.`;

  await notifyHousehold(householdId, { title, body });
}

// POST /api/transactions/scan-receipt — ekstrak tanggal/nominal/kategori dari foto struk
// pakai Claude vision. TIDAK langsung menyimpan transaksi — cuma prefill,
// user tetap review & submit lewat POST / yang normal seperti biasa.
router.post('/scan-receipt', (req, res) => {
  receiptUpload.single('receipt')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Gagal membaca foto struk' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'File foto wajib diisi' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === 'isi-anthropic-api-key') {
      return res.status(503).json({ error: 'Fitur scan struk belum dikonfigurasi (ANTHROPIC_API_KEY belum diisi)' });
    }

    try {
      const anthropic = new Anthropic({ apiKey });
      const base64Image = req.file.buffer.toString('base64');

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: req.file.mimetype, data: base64Image }
            },
            {
              type: 'text',
              text: 'Ini foto struk belanja. Ekstrak informasinya dan balas HANYA dengan JSON ' +
                'valid (tanpa markdown/teks lain) persis format ini: ' +
                '{"date":"YYYY-MM-DD","amount":<angka total belanja tanpa titik/koma>,' +
                '"suggested_category":"<kategori singkat dalam Bahasa Indonesia, mis. Rumah Tangga/Kebutuhan Pokok/Transportasi>",' +
                '"note":"<nama toko/warung kalau ada>"}. ' +
                'Kalau tanggal tidak terbaca, pakai null. Kalau total tidak terbaca, pakai 0.'
            }
          ]
        }]
      });

      const textBlock = message.content.find(b => b.type === 'text');
      const raw = (textBlock?.text || '').trim().replace(/^```json\s*|```$/g, '');
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return res.status(502).json({ error: 'Gagal membaca hasil dari AI, coba lagi dengan foto yang lebih jelas' });
      }

      res.json({
        date: parsed.date || null,
        amount: Number(parsed.amount) || 0,
        suggested_category: parsed.suggested_category || '',
        note: parsed.note || ''
      });
    } catch (err) {
      console.error('Scan receipt error:', err);
      res.status(500).json({ error: 'Gagal memproses foto struk' });
    }
  });
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

// GET /api/transactions/export?month=YYYY-MM — export transaksi bulan tertentu sebagai file CSV
// CSV dibuat di backend (bukan JSON mentah ke frontend) supaya escaping/format
// hanya hidup di satu tempat dan frontend tinggal trigger download file, tanpa
// perlu library CSV di bundle.
router.get('/export', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.status(400).json({ error: 'Belum punya household' });

    const { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Parameter month wajib format YYYY-MM' });
    }
    const [year, mm] = month.split('-');

    const result = await pool.query(
      `SELECT to_char(t.date, 'YYYY-MM-DD') as date, t.type, t.category, t.amount, t.note, u.name as creator_name, u.email as creator_email
       FROM transactions t
       JOIN users u ON u.id = t.created_by
       WHERE t.household_id = $1
         AND EXTRACT(MONTH FROM t.date) = $2 AND EXTRACT(YEAR FROM t.date) = $3
       ORDER BY t.date, t.created_at`,
      [householdId, mm, year]
    );

    const escapeCsv = (v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const header = ['Tanggal', 'Tipe', 'Kategori', 'Nominal', 'Catatan', 'Dicatat Oleh'];
    const rows = result.rows.map(r => [
      r.date,
      r.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      r.category,
      r.amount,
      r.note || '',
      r.creator_name || r.creator_email
    ].map(escapeCsv).join(','));

    const csv = [header.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="transaksi-${month}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('Export transactions error:', err);
    res.status(500).json({ error: 'Gagal export data' });
  }
});

// GET /api/transactions/contributions?month=YYYY-MM — total pengeluaran per anggota
// (Fase 3: transparansi "siapa belanja apa", sensitif — UI-nya default disembunyikan)
router.get('/contributions', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.json({ contributions: [] });

    const { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Parameter month wajib format YYYY-MM' });
    }
    const [year, mm] = month.split('-');

    const result = await pool.query(
      `SELECT t.created_by, u.name as creator_name, u.email as creator_email,
              COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END), 0) as expense,
              COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount ELSE 0 END), 0) as income
       FROM transactions t
       JOIN users u ON u.id = t.created_by
       WHERE t.household_id = $1
         AND EXTRACT(MONTH FROM t.date) = $2 AND EXTRACT(YEAR FROM t.date) = $3
       GROUP BY t.created_by, u.name, u.email
       ORDER BY expense DESC`,
      [householdId, mm, year]
    );

    res.json({
      contributions: result.rows.map(r => ({
        userId: r.created_by,
        name: r.creator_name || r.creator_email,
        expense: parseFloat(r.expense),
        income: parseFloat(r.income)
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil ringkasan kontribusi' });
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
