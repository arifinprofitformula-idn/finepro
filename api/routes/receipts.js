// api/routes/receipts.js
// Scan struk dua tahap — dipindah dari api/routes/transactions.js supaya
// kuota/rate-limit-nya (lihat SCAN_LIMIT_PER_MONTH) punya rumah sendiri yang
// jelas, terpisah dari CRUD transaksi. TIDAK langsung menyimpan transaksi —
// cuma prefill draft, user tetap review & submit lewat POST /api/transactions
// yang normal.
//
// Arsitektur: foto -> OCR lokal (Tesseract) -> regex TOTAL/tanggal -> kalau
// gagal/kurang yakin baru teks OCR (bukan gambar) dikirim ke LLM murah
// (default Claude Haiku). Lihat api/services/receiptExtraction.js.

import { Router } from 'express';
import multer from 'multer';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { getSetting } from '../services/appSettings.js';
import { extractText, tryRegexExtraction, parseReceiptText } from '../services/receiptExtraction.js';

const router = Router();
router.use(authMiddleware);

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

async function countScansThisMonth(householdId) {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM receipt_scans
     WHERE household_id = $1 AND created_at >= date_trunc('month', now())`,
    [householdId]
  );
  return parseInt(result.rows[0].count, 10);
}

// GET /api/receipts/quota — sisa kuota scan bulan ini, dipakai badge di UI
router.get('/quota', async (req, res) => {
  try {
    const aiConfig = await getSetting('ai');
    const scanLimit = Number(aiConfig.receipt_scan_monthly_limit || 30);
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.json({ used: 0, limit: scanLimit, remaining: scanLimit });

    const used = await countScansThisMonth(householdId);
    res.json({ used, limit: scanLimit, remaining: Math.max(0, scanLimit - used) });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil sisa kuota' });
  }
});

// POST /api/receipts/scan — ekstrak tanggal/nominal/kategori dari foto struk
router.post('/scan', (req, res) => {
  receiptUpload.single('receipt')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Gagal membaca foto struk' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'File foto wajib diisi' });
    }

    const aiConfig = await getSetting('ai');

    try {
      const householdId = await getUserHouseholdId(req.user.userId);
      if (!householdId) return res.status(400).json({ error: 'Belum punya household' });

      const used = await countScansThisMonth(householdId);
      const scanLimit = Number(aiConfig.receipt_scan_monthly_limit || 30);
      if (used >= scanLimit) {
        return res.status(429).json({
          error: `Kuota scan struk bulan ini sudah habis (${scanLimit}/bulan). Silakan input transaksi manual, atau coba lagi bulan depan.`
        });
      }

      const rawText = await extractText(req.file.buffer);

      // Coba regex dulu (TOTAL/GRAND TOTAL + tanggal) — kalau confidence
      // tinggi, LLM sama sekali tidak dipanggil (nol biaya tambahan).
      let parsed = tryRegexExtraction(rawText);

      if (!parsed) {
        const apiKey = aiConfig.anthropic_api_key;
        if (!aiConfig.enabled || !apiKey || apiKey === 'isi-anthropic-api-key') {
          return res.status(503).json({
            error: 'Struk tidak bisa dibaca otomatis dan fitur AI belum dikonfigurasi. Silakan input transaksi manual.'
          });
        }
        try {
          // Sengaja TIDAK pakai aiConfig.model — itu model untuk fitur AI lain
          // (mis. insights) yang biasanya di-set ke Sonnet/Opus. Parsing teks
          // struk selalu lewat model murah (default Haiku, lihat env
          // ANTHROPIC_HAIKU_MODEL / RECEIPT_PARSE_PROVIDER).
          parsed = await parseReceiptText(rawText, { apiKey });
        } catch (parseErr) {
          console.error('Parse receipt text error:', parseErr);
          return res.status(502).json({ error: 'Gagal membaca hasil dari AI, coba lagi dengan foto yang lebih jelas' });
        }
      }

      // Dicatat setelah proses (OCR dan/atau LLM) selesai — supaya kuota
      // tetap jadi jaring pengaman meski biaya per scan sudah jauh lebih
      // rendah dibanding kirim gambar langsung ke vision model.
      await pool.query(
        'INSERT INTO receipt_scans (household_id, created_by) VALUES ($1, $2)',
        [householdId, req.user.userId]
      );

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

export default router;
