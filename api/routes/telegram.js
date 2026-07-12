// api/routes/telegram.js
// Integrasi Telegram lewat n8n: user menghubungkan akun Telegram ke akun
// finepro (link/start + link/confirm), lalu foto struk/bukti transfer yang
// dikirim ke bot diteruskan n8n ke POST /receipts untuk otomatis jadi
// transaksi. Endpoint link/confirm dan /receipts dipanggil n8n (bukan user
// login web), makanya pakai telegramServiceMiddleware (shared secret),
// bukan authMiddleware (JWT user).

import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import pool from '../db.js';
import { authMiddleware, telegramServiceMiddleware } from '../middleware/auth.js';
import { getSetting } from '../services/appSettings.js';
import { isAiConfigured } from '../services/aiProvider.js';
import { extractText, tryRegexExtraction, parseReceiptText } from '../services/receiptExtraction.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'telegram');

const router = Router();

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

async function resolveDefaultWalletId(householdId) {
  const defaultWallet = await pool.query(
    'SELECT id FROM wallets WHERE household_id = $1 AND is_default = true LIMIT 1',
    [householdId]
  );
  return defaultWallet.rows[0]?.id || null;
}

function generateLinkCode() {
  // 6 digit numerik — cukup pendek untuk diketik manual di Telegram kalau
  // deep-link gagal terbuka, cukup acak untuk masa berlaku 10 menit.
  return String(crypto.randomInt(100000, 1000000));
}

// POST /api/telegram/link/start — user login web minta kode untuk
// menghubungkan akun Telegram-nya.
router.post('/link/start', authMiddleware, async (req, res) => {
  try {
    const code = generateLinkCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      'INSERT INTO telegram_link_codes (code, user_id, expires_at) VALUES ($1, $2, $3)',
      [code, req.user.userId, expiresAt]
    );

    const { bot_username } = await getSetting('telegram');
    res.json({
      code,
      expires_at: expiresAt.toISOString(),
      deep_link: bot_username ? `https://t.me/${bot_username}?start=${code}` : null,
    });
  } catch (err) {
    console.error('Telegram link start error:', err);
    res.status(500).json({ error: 'Gagal membuat kode hubung Telegram' });
  }
});

// POST /api/telegram/link/confirm — dipanggil n8n ketika user mengirim
// "/start <code>" ke bot. Body: { code, telegram_id, telegram_username }.
router.post('/link/confirm', telegramServiceMiddleware, async (req, res) => {
  try {
    const { code, telegram_id, telegram_username } = req.body;
    if (!code || !telegram_id) {
      return res.status(400).json({ error: 'code dan telegram_id wajib diisi' });
    }

    const linkResult = await pool.query(
      `SELECT user_id FROM telegram_link_codes
       WHERE code = $1 AND used_at IS NULL AND expires_at > now()`,
      [code]
    );
    const link = linkResult.rows[0];
    if (!link) {
      return res.status(400).json({
        error: 'Kode tidak valid atau sudah kedaluwarsa',
        message: 'Kode sudah tidak berlaku. Buka kembali halaman Akun di finepro.my.id untuk minta kode baru.',
      });
    }

    await pool.query(
      'UPDATE users SET telegram_id = $1, telegram_username = $2 WHERE id = $3',
      [telegram_id, telegram_username || null, link.user_id]
    );
    await pool.query('UPDATE telegram_link_codes SET used_at = now() WHERE code = $1', [code]);

    const userResult = await pool.query('SELECT name, email FROM users WHERE id = $1', [link.user_id]);
    const user = userResult.rows[0];

    res.json({
      ok: true,
      message: `Akun Telegram berhasil terhubung ke ${user?.name || user?.email}. Kirim foto struk belanja atau bukti transfer untuk otomatis dicatat.`,
    });
  } catch (err) {
    if (err.code === '23505') {
      // unique violation pada users.telegram_id — akun Telegram ini sudah
      // terhubung ke akun finepro lain.
      return res.status(409).json({
        error: 'Akun Telegram sudah terhubung ke akun finepro lain',
        message: 'Akun Telegram ini sudah terhubung ke akun finepro lain. Hubungi pemilik akun kalau ini keliru.',
      });
    }
    console.error('Telegram link confirm error:', err);
    res.status(500).json({ error: 'Gagal menghubungkan akun Telegram' });
  }
});

// DELETE /api/telegram/link — user login web memutus koneksi Telegram dari
// akun finepro-nya. Riwayat transaksi/scan tetap disimpan; yang dicabut hanya
// mapping telegram_id agar bot tidak bisa mencatat atas nama user ini lagi.
router.delete('/link', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE users
       SET telegram_id = NULL, telegram_username = NULL
       WHERE id = $1
       RETURNING id, email, name, avatar_url, role, created_at, telegram_id, telegram_username, (password_hash IS NOT NULL) AS has_password`,
      [req.user.userId]
    );

    await pool.query(
      'UPDATE telegram_link_codes SET used_at = now() WHERE user_id = $1 AND used_at IS NULL',
      [req.user.userId]
    );

    const user = result.rows[0];
    res.json({ user, message: 'Akun Telegram berhasil diputuskan' });
  } catch (err) {
    console.error('Telegram unlink error:', err);
    res.status(500).json({ error: 'Gagal memutus koneksi Telegram' });
  }
});

// POST /api/telegram/receipts — dipanggil n8n setiap foto struk/bukti
// transfer masuk dari user yang sudah terhubung. Reuse penuh pipeline OCR
// dari api/services/receiptExtraction.js, lalu langsung simpan sebagai
// transaksi (auto-save, tanpa tahap review seperti alur web).
router.post('/receipts', telegramServiceMiddleware, async (req, res) => {
  // Jika ada file_id, download foto dari Telegram dulu
  if (req.body.file_id && req.body.bot_token) {
    try {
      const tgUrl = `https://api.telegram.org/bot${req.body.bot_token}/getFile?file_id=${req.body.file_id}`;
      const tgResp = await fetch(tgUrl).then(r => r.json());
      if (!tgResp.ok || !tgResp.result?.file_path) {
        return res.status(400).json({ error: 'Gagal mengambil file dari Telegram', message: 'File tidak ditemukan di server Telegram.' });
      }
      const fileUrl = `https://api.telegram.org/file/bot${req.body.bot_token}/${tgResp.result.file_path}`;
      const fileResp = await fetch(fileUrl);
      if (!fileResp.ok) {
        return res.status(400).json({ error: 'Gagal mengunduh foto', message: 'Foto gagal diunduh dari Telegram.' });
      }
      const buffer = Buffer.from(await fileResp.arrayBuffer());
      req.file = { buffer, mimetype: 'image/jpeg', size: buffer.length };
      req.body = req.body; // keep telegram_id etc
    } catch (e) {
      console.error('Telegram file download error:', e);
      return res.status(400).json({ error: 'Gagal mengunduh foto', message: 'Terjadi kesalahan saat mengunduh foto.' });
    }
  }

  // Fallback: terima upload langsung (binary)
  if (!req.file) {
    receiptUpload.single('photo')(req, res, async (err) => {
      if (err) return res.status(400).json({ error: err.message || 'Gagal membaca foto' });
      if (!req.file) return res.status(400).json({ error: 'File foto wajib diisi' });
      await processReceipt(req, res);
    });
    return;
  }

  await processReceipt(req, res);
});

// Ekstrak ke fungsi terpisah
async function processReceipt(req, res) {
  const telegramId = req.body.telegram_id;
    if (!telegramId) {
      return res.status(400).json({ error: 'telegram_id wajib diisi' });
    }

    try {
      const userResult = await pool.query('SELECT id FROM users WHERE telegram_id = $1', [telegramId]);
      const user = userResult.rows[0];
      if (!user) {
        return res.status(404).json({
          error: 'Akun Telegram belum terhubung',
          message: 'Akun Telegram kamu belum terhubung ke finepro.my.id. Buka halaman Akun di web untuk menghubungkan dulu.',
        });
      }

      const householdId = await getUserHouseholdId(user.id);
      if (!householdId) {
        return res.status(400).json({
          error: 'Belum punya household',
          message: 'Akun kamu belum tergabung di household manapun di finepro.my.id.',
        });
      }

      const aiConfig = await getSetting('ai');
      const used = await countScansThisMonth(householdId);
      const scanLimit = Number(aiConfig.receipt_scan_monthly_limit || 30);
      if (used >= scanLimit) {
        return res.status(429).json({
          error: 'Kuota scan bulan ini habis',
          message: `Kuota scan struk bulan ini sudah habis (${scanLimit}/bulan). Catat manual dulu di web, atau coba lagi bulan depan.`,
        });
      }

      const rawText = await extractText(req.file.buffer);
      let parsed = tryRegexExtraction(rawText);

      if (!parsed) {
        if (!isAiConfigured(aiConfig)) {
          return res.status(503).json({
            error: 'AI belum dikonfigurasi',
            message: 'Foto tidak bisa dibaca otomatis dan fitur AI belum dikonfigurasi. Catat manual dulu di web.',
          });
        }
        try {
          parsed = await parseReceiptText(rawText, { aiConfig });
        } catch (parseErr) {
          console.error('Telegram parse receipt error:', parseErr);
          await pool.query(
            `INSERT INTO telegram_receipts (household_id, created_by, telegram_id, raw_text, status, error_message)
             VALUES ($1, $2, $3, $4, 'failed', $5)`,
            [householdId, user.id, telegramId, rawText, 'Gagal membaca hasil dari AI']
          );
          return res.status(502).json({
            error: 'Gagal membaca foto',
            message: 'Foto tidak terbaca dengan jelas. Coba foto ulang dengan pencahayaan lebih baik, atau catat manual di web.',
          });
        }
      }

      const amount = Number(parsed.amount) || 0;
      const date = parsed.date || new Date().toISOString().slice(0, 10);
      const type = parsed.type === 'income' ? 'income' : 'expense';
      const docType = parsed.document_type === 'transfer' ? 'transfer' : 'receipt';
      const category = parsed.suggested_category || (type === 'income' ? 'Transfer Masuk' : 'Lainnya');
      const note = parsed.note || null;

      if (amount <= 0) {
        await pool.query(
          `INSERT INTO telegram_receipts (household_id, created_by, telegram_id, doc_type, raw_text, extracted, status, error_message)
           VALUES ($1, $2, $3, $4, $5, $6, 'failed', $7)`,
          [householdId, user.id, telegramId, docType, rawText, JSON.stringify(parsed), 'Nominal tidak terbaca']
        );
        return res.status(422).json({
          error: 'Nominal tidak terbaca',
          message: 'Nominal di foto tidak terbaca. Coba foto yang lebih jelas, atau catat manual di web.',
        });
      }

      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      const filename = `${crypto.randomUUID()}.jpg`;
      const imagePath = path.join(UPLOAD_DIR, filename);
      await fs.writeFile(imagePath, req.file.buffer);
      const publicImagePath = `/uploads/telegram/${filename}`;

      const walletId = await resolveDefaultWalletId(householdId);

      const txResult = await pool.query(
        `INSERT INTO transactions (household_id, created_by, date, type, category, amount, note, wallet_id, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'telegram')
         RETURNING id, to_char(date, 'YYYY-MM-DD') as date, type, category, amount, note`,
        [householdId, user.id, date, type, category, amount, note, walletId]
      );
      const transaction = txResult.rows[0];

      await pool.query(
        'INSERT INTO receipt_scans (household_id, created_by) VALUES ($1, $2)',
        [householdId, user.id]
      );
      await pool.query(
        `INSERT INTO telegram_receipts (household_id, created_by, telegram_id, doc_type, image_path, raw_text, extracted, transaction_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'success')`,
        [householdId, user.id, telegramId, docType, publicImagePath, rawText, JSON.stringify(parsed), transaction.id]
      );

      const typeLabel = type === 'income' ? 'Pemasukan' : 'Pengeluaran';
      const amountLabel = new Intl.NumberFormat('id-ID').format(amount);
      res.json({
        transaction,
        message: `Tercatat: ${typeLabel} Rp${amountLabel} — ${category}${note ? ` (${note})` : ''} pada ${date}.`,
      });
    } catch (err) {
      console.error('Telegram receipt error:', err);
      res.status(500).json({ error: 'Gagal memproses foto', message: 'Terjadi kesalahan, coba lagi beberapa saat.' });
    }
}

export default router;
