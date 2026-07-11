// api/routes/receipts.js
// Scan struk lewat Claude vision — dipindah dari api/routes/transactions.js
// supaya kuota/rate-limit-nya (lihat SCAN_LIMIT_PER_MONTH) punya rumah
// sendiri yang jelas, terpisah dari CRUD transaksi. TIDAK langsung
// menyimpan transaksi — cuma prefill draft, user tetap review & submit
// lewat POST /api/transactions yang normal.

import { Router } from 'express';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// 30 scan/household/bulan — dipilih supaya biaya Claude vision per household
// aktif tetap wajar (~$0.30-0.60/bulan dengan Claude Sonnet vision di kisaran
// $0.01-0.02/scan tergantung ukuran foto). Sesuaikan di sini kalau plafon
// biaya berubah.
const SCAN_LIMIT_PER_MONTH = 30;

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
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.json({ used: 0, limit: SCAN_LIMIT_PER_MONTH, remaining: SCAN_LIMIT_PER_MONTH });

    const used = await countScansThisMonth(householdId);
    res.json({ used, limit: SCAN_LIMIT_PER_MONTH, remaining: Math.max(0, SCAN_LIMIT_PER_MONTH - used) });
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

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === 'isi-anthropic-api-key') {
      return res.status(503).json({ error: 'Fitur scan struk belum dikonfigurasi (ANTHROPIC_API_KEY belum diisi)' });
    }

    try {
      const householdId = await getUserHouseholdId(req.user.userId);
      if (!householdId) return res.status(400).json({ error: 'Belum punya household' });

      const used = await countScansThisMonth(householdId);
      if (used >= SCAN_LIMIT_PER_MONTH) {
        return res.status(429).json({
          error: `Kuota scan struk bulan ini sudah habis (${SCAN_LIMIT_PER_MONTH}/bulan). Silakan input transaksi manual, atau coba lagi bulan depan.`
        });
      }

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

      // Dicatat SETELAH panggilan Claude sukses (biaya API sudah timbul di
      // titik ini terlepas hasil JSON-nya kebaca atau tidak di bawah) —
      // supaya kuota mencerminkan biaya nyata, bukan cuma scan yang "berhasil".
      await pool.query(
        'INSERT INTO receipt_scans (household_id, created_by) VALUES ($1, $2)',
        [householdId, req.user.userId]
      );

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

export default router;
