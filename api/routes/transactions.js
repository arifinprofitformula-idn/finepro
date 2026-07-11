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

// Cursor keyset pagination dipilih (bukan page+limit/OFFSET) karena tabel
// transactions diurut DESC by (date, created_at, id) dan bisa tumbuh ribuan
// baris per household seiring waktu pakai. OFFSET N harus men-scan &
// membuang N baris pertama tiap request — makin lambat makin jauh usernya
// scroll ke belakang. Keyset ("ambil yang lebih lama dari baris terakhir
// yang saya lihat") selalu pakai index idx_transactions_household_date,
// jadi biaya query konstan di halaman manapun. Trade-off: tidak bisa lompat
// ke "halaman 5" langsung — cocok untuk pola akses riwayat yang selalu
// linear (scroll/"muat lebih banyak"), yang memang satu-satunya pola akses
// yang dibutuhkan HistoryPage (frontend/src/pages/HistoryPage.jsx).
function encodeCursor(row) {
  return Buffer.from(JSON.stringify({ date: row.date, created_at: row.created_at, id: row.id })).toString('base64url');
}
function decodeCursor(raw) {
  try {
    const obj = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (!obj.date || !obj.created_at || !obj.id) return null;
    return obj;
  } catch {
    return null;
  }
}

function buildTransactionFilters(req, householdId) {
  const { month, year, type, category, wallet_id, search, date_from, date_to } = req.query;
  const where = ['t.household_id = $1'];
  const params = [householdId];

  if (month && year) {
    params.push(month, year);
    where.push(`EXTRACT(MONTH FROM t.date) = $${params.length - 1} AND EXTRACT(YEAR FROM t.date) = $${params.length}`);
  }
  if (type && ['income', 'expense'].includes(type)) {
    params.push(type);
    where.push(`t.type = $${params.length}`);
  }
  if (category) {
    params.push(category);
    where.push(`t.category = $${params.length}`);
  }
  if (wallet_id) {
    params.push(wallet_id);
    where.push(`t.wallet_id = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    where.push(`t.note ILIKE $${params.length}`);
  }
  if (date_from) {
    params.push(date_from);
    where.push(`t.date >= $${params.length}`);
  }
  if (date_to) {
    params.push(date_to);
    where.push(`t.date <= $${params.length}`);
  }

  return { where, params };
}

// GET /api/transactions — riwayat transaksi, dengan filter opsional (type,
// category, wallet_id, search di kolom note, date_from/date_to, atau
// month+year untuk kompatibilitas lama) dan cursor pagination (lihat
// encodeCursor di atas untuk alasan keyset vs offset).
router.get('/', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.json({ transactions: [], next_cursor: null, has_more: false });

    const { where, params } = buildTransactionFilters(req, householdId);

    const cursor = req.query.cursor ? decodeCursor(req.query.cursor) : null;
    if (cursor) {
      params.push(cursor.date, cursor.created_at, cursor.id);
      where.push(`(t.date, t.created_at, t.id) < ($${params.length - 2}::date, $${params.length - 1}::timestamptz, $${params.length}::uuid)`);
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 100);
    params.push(limit + 1);

    const result = await pool.query(
      `SELECT t.id, to_char(t.date, 'YYYY-MM-DD') as date, t.type, t.category, t.amount, t.note, t.created_at, t.created_by, t.wallet_id,
              u.name as creator_name, u.email as creator_email
       FROM transactions t
       JOIN users u ON u.id = t.created_by
       WHERE ${where.join(' AND ')}
       ORDER BY t.date DESC, t.created_at DESC, t.id DESC
       LIMIT $${params.length}`,
      params
    );

    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
    const nextCursor = hasMore ? encodeCursor(rows[rows.length - 1]) : null;

    res.json({ transactions: rows, next_cursor: nextCursor, has_more: hasMore });
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

// GET /api/transactions/export?format=csv — export transaksi sebagai file CSV,
// menerima filter query yang sama dengan GET /api/transactions (type, category,
// wallet_id, search, date_from/date_to, atau month+year lama). Filter kosong =
// seluruh riwayat household. CSV dibuat di backend (bukan JSON mentah ke
// frontend) supaya escaping/format hanya hidup di satu tempat dan frontend
// tinggal trigger download file, tanpa perlu library CSV di bundle.
router.get('/export', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.status(400).json({ error: 'Belum punya household' });

    const { where, params } = buildTransactionFilters(req, householdId);
    const { month } = req.query;

    const result = await pool.query(
      `SELECT to_char(t.date, 'YYYY-MM-DD') as date, t.type, t.category, t.amount, t.note, u.name as creator_name, u.email as creator_email
       FROM transactions t
       JOIN users u ON u.id = t.created_by
       WHERE ${where.join(' AND ')}
       ORDER BY t.date, t.created_at`,
      params
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

    const filenameSuffix = month || new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="transaksi-${filenameSuffix}.csv"`);
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

// GET /api/transactions/monthly-summary?year=YYYY — total masuk/keluar per bulan
// (Jan-Des) untuk grafik "Analisis Bulanan" di dashboard — diagregasi di SQL
// supaya frontend tidak perlu fetch transaksi 12x per bulan.
router.get('/monthly-summary', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    if (!householdId) {
      return res.json({ year, months: Array.from({ length: 12 }, () => ({ income: 0, expense: 0 })) });
    }

    const result = await pool.query(
      `SELECT EXTRACT(MONTH FROM date)::int as month,
              COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0) as income,
              COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) as expense
       FROM transactions
       WHERE household_id = $1 AND EXTRACT(YEAR FROM date) = $2
       GROUP BY 1`,
      [householdId, year]
    );

    const byMonth = new Map(result.rows.map((r) => [r.month, r]));
    const months = Array.from({ length: 12 }, (_, i) => {
      const row = byMonth.get(i + 1);
      return { income: parseFloat(row?.income || 0), expense: parseFloat(row?.expense || 0) };
    });

    res.json({ year, months });
  } catch (err) {
    console.error('Monthly summary error:', err);
    res.status(500).json({ error: 'Gagal mengambil ringkasan bulanan' });
  }
});

// GET /api/transactions/summary-by-category?category=X&period=year — total
// pengeluaran per bulan untuk satu kategori, 12 bulan terakhir (rolling,
// berakhir di bulan berjalan) — dipakai untuk grafik tren kategori tertentu
// (mis. Zakat & Sedekah) di luar ringkasan bulan-ini yang sudah ada di
// /zakat-summary. period=year saat ini satu-satunya nilai yang didukung.
router.get('/summary-by-category', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    const { category, period } = req.query;
    if (!category) return res.status(400).json({ error: 'Parameter category wajib diisi' });
    if (period && period !== 'year') return res.status(400).json({ error: 'Parameter period saat ini hanya mendukung "year"' });

    if (!householdId) return res.json({ category, months: [] });

    const result = await pool.query(
      `SELECT to_char(date_trunc('month', date), 'YYYY-MM') as month, SUM(amount) as total
       FROM transactions
       WHERE household_id = $1 AND type = 'expense' AND category = $2
         AND date >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
       GROUP BY 1`,
      [householdId, category]
    );
    const byMonth = new Map(result.rows.map((r) => [r.month, parseFloat(r.total)]));

    // Bangun key YYYY-MM lewat aritmatika tahun/bulan langsung, BUKAN
    // `new Date(y, m, 1).toISOString()` — toISOString() mengonversi ke UTC,
    // dan di server WIB (UTC+7) itu menggeser tanggal 1 mundur ke akhir
    // bulan sebelumnya, jadi bulan berjalan hilang dari hasil.
    const months = [];
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth(); // 0-indexed
    for (let i = 11; i >= 0; i--) {
      let mm = m - i;
      let yy = y;
      while (mm < 0) {
        mm += 12;
        yy -= 1;
      }
      const key = `${yy}-${String(mm + 1).padStart(2, '0')}`;
      months.push({ month: key, total: byMonth.get(key) || 0 });
    }

    res.json({ category, months });
  } catch (err) {
    console.error('Summary by category error:', err);
    res.status(500).json({ error: 'Gagal mengambil ringkasan per kategori' });
  }
});

// GET /api/transactions/zakat-summary — total Zakat & Sedekah bulan ini + streak bulan berturut-turut
router.get('/zakat-summary', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.json({ thisMonth: 0, streakMonths: 0 });

    const result = await pool.query(
      `SELECT to_char(date_trunc('month', date), 'YYYY-MM') as month, SUM(amount) as total
       FROM transactions
       WHERE household_id = $1 AND type = 'expense' AND category = 'Zakat & Sedekah'
       GROUP BY 1
       ORDER BY 1 DESC`,
      [householdId]
    );

    const monthsWithEntries = new Set(result.rows.map((r) => r.month));
    const thisMonthKey = new Date().toISOString().slice(0, 7);
    const thisMonth = parseFloat(
      result.rows.find((r) => r.month === thisMonthKey)?.total || 0
    );

    let streakMonths = 0;
    const cursor = new Date();
    while (true) {
      const key = cursor.toISOString().slice(0, 7);
      if (!monthsWithEntries.has(key)) break;
      streakMonths += 1;
      cursor.setMonth(cursor.getMonth() - 1);
    }

    res.json({ thisMonth, streakMonths });
  } catch (err) {
    console.error('Zakat summary error:', err);
    res.status(500).json({ error: 'Gagal mengambil ringkasan zakat' });
  }
});

export default router;
