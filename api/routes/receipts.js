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
import { isAiConfigured } from '../services/aiProvider.js';
import { normalizeTransactionCategory } from '../services/categoryMatcher.js';
import { extractText, tryRegexExtraction, parseReceiptText, sanitizeDate } from '../services/receiptExtraction.js';
import { assertQuotaAvailable, getQuotaStatus, recordAiUsage } from '../services/aiUsage.js';

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

// GET /api/receipts/quota — sisa kuota scan bulan ini, dipakai badge di UI
router.get('/quota', async (req, res) => {
  try {
    const aiConfig = await getSetting('ai');
    const scanLimit = Number(aiConfig.receipt_scan_monthly_limit || 30);
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.json({ used: 0, limit: scanLimit, remaining: scanLimit });

    const status = await getQuotaStatus(householdId, 'receipt_scan');
    res.json(status);
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

      await assertQuotaAvailable(householdId, 'receipt_scan', 'Kuota scan otomatis');

      const rawText = await extractText(req.file.buffer);
      let usedAi = false;

      // Coba regex dulu (TOTAL/GRAND TOTAL + tanggal) — kalau confidence
      // tinggi, LLM sama sekali tidak dipanggil (nol biaya tambahan).
      let parsed = tryRegexExtraction(rawText);

      if (!parsed) {
        if (!isAiConfigured(aiConfig)) {
          return res.status(503).json({
            error: 'Struk tidak bisa dibaca otomatis dan fitur AI belum dikonfigurasi. Silakan input transaksi manual.'
          });
        }
        try {
          // Parsing teks struk memakai model murah dari provider aktif
          // (default SumoPod gpt-4o-mini, Anthropic tetap bisa dipilih).
          usedAi = true;
          parsed = await parseReceiptText(rawText, { aiConfig });
        } catch (parseErr) {
          console.error('Parse receipt text error:', parseErr);
          await recordAiUsage({
            householdId,
            userId: req.user.userId,
            feature: 'receipt_scan',
            source: 'web',
            usedAi,
            provider: usedAi ? aiConfig.provider : null,
            model: usedAi ? (aiConfig.sumopod_model || aiConfig.anthropic_model || aiConfig.model || null) : null,
            metadata: { status: 'failed', reason: 'ai_parse_error' },
          });
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
      await recordAiUsage({
        householdId,
        userId: req.user.userId,
        feature: 'receipt_scan',
        source: 'web',
        usedAi,
        provider: usedAi ? aiConfig.provider : null,
        model: usedAi ? (aiConfig.sumopod_model || aiConfig.anthropic_model || aiConfig.model || null) : null,
        metadata: { status: 'success', parser: parsed.source || (usedAi ? 'ai' : 'regex') },
      });

      const intentType = req.body?.intent_type === 'income' ? 'income' : 'expense';
      const type = intentType === 'income' ? 'income' : parsed.type === 'income' ? 'income' : 'expense';
      const category = await normalizeTransactionCategory(
        householdId,
        type,
        `${parsed.suggested_category || ''} ${parsed.note || ''}`.trim() || (type === 'income' ? 'Transfer Masuk' : 'Lainnya')
      );

      res.json({
        date: sanitizeDate(parsed.date, rawText),
        amount: Number(parsed.amount) || 0,
        type,
        suggested_category: category,
        note: parsed.note || ''
      });
    } catch (err) {
      console.error('Scan receipt error:', err);
      res.status(500).json({ error: 'Gagal memproses foto struk' });
    }
  });
});

export default router;
