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
import { generateChatText, isAiConfigured } from '../services/aiProvider.js';
import { normalizeTransactionCategory } from '../services/categoryMatcher.js';
import { extractText, tryRegexExtraction, parseReceiptText, sanitizeDate } from '../services/receiptExtraction.js';
import { checkBudgetThreshold } from '../services/transactionEffects.js';
import { assertQuotaAvailable, recordAiUsage } from '../services/aiUsage.js';

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

function normalizeBotUsername(value) {
  return String(value || '').trim().replace(/^@+/, '');
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

    const telegramSetting = await getSetting('telegram');
    const botUsername = normalizeBotUsername(telegramSetting.bot_username);
    res.json({
      code,
      expires_at: expiresAt.toISOString(),
      bot_username: botUsername || null,
      deep_link: botUsername ? `https://t.me/${botUsername}?start=${encodeURIComponent(code)}` : null,
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
      try {
        await assertQuotaAvailable(householdId, 'receipt_scan', 'Kuota scan otomatis');
      } catch (quotaErr) {
        return res.status(quotaErr.status || 429).json({
          error: 'Kuota scan habis',
          message: `${quotaErr.message} Catat manual dulu di web, atau upgrade paket.`,
          quota: quotaErr.quota,
        });
      }

      const rawText = await extractText(req.file.buffer);
      let parsed = tryRegexExtraction(rawText);
      let usedAi = false;

      if (!parsed) {
        if (!isAiConfigured(aiConfig)) {
          return res.status(503).json({
            error: 'AI belum dikonfigurasi',
            message: 'Foto tidak bisa dibaca otomatis dan fitur AI belum dikonfigurasi. Catat manual dulu di web.',
          });
        }
        try {
          usedAi = true;
          parsed = await parseReceiptText(rawText, { aiConfig });
        } catch (parseErr) {
          console.error('Telegram parse receipt error:', parseErr);
          await recordAiUsage({
            householdId,
            userId: user.id,
            feature: 'receipt_scan',
            source: 'telegram',
            usedAi,
            provider: usedAi ? aiConfig.provider : null,
            model: usedAi ? (aiConfig.sumopod_model || aiConfig.anthropic_model || aiConfig.model || null) : null,
            metadata: { status: 'failed', reason: 'ai_parse_error', telegram_id: telegramId },
          });
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
      const date = sanitizeDate(parsed.date, rawText);
      const type = parsed.type === 'income' ? 'income' : 'expense';
      const docType = parsed.document_type === 'transfer' ? 'transfer' : 'receipt';
      const category = await normalizeTransactionCategory(
        householdId,
        type,
        `${parsed.suggested_category || ''} ${parsed.note || ''}`.trim() || (type === 'income' ? 'Transfer Masuk' : 'Lainnya')
      );
      const note = parsed.note || null;

      if (amount <= 0) {
        await recordAiUsage({
          householdId,
          userId: user.id,
          feature: 'receipt_scan',
          source: 'telegram',
          usedAi,
          provider: usedAi ? aiConfig.provider : null,
          model: usedAi ? (aiConfig.sumopod_model || aiConfig.anthropic_model || aiConfig.model || null) : null,
          metadata: { status: 'failed', reason: 'amount_not_found', telegram_id: telegramId },
        });
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

      if (type === 'expense') {
        checkBudgetThreshold(householdId, category, date, amount).catch((err) =>
          console.error('Telegram budget threshold check error:', err)
        );
      }

      await pool.query(
        'INSERT INTO receipt_scans (household_id, created_by) VALUES ($1, $2)',
        [householdId, user.id]
      );
      await recordAiUsage({
        householdId,
        userId: user.id,
        feature: 'receipt_scan',
        source: 'telegram',
        usedAi,
        provider: usedAi ? aiConfig.provider : null,
        model: usedAi ? (aiConfig.sumopod_model || aiConfig.anthropic_model || aiConfig.model || null) : null,
        metadata: { status: 'success', parser: parsed.source || (usedAi ? 'ai' : 'regex'), telegram_id: telegramId, transaction_id: transaction.id },
      });
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

// POST /api/telegram/chat — dipanggil n8n untuk setiap pesan teks yang bukan
// /start (link) dan bukan foto. Endpoint ini membalas secara kontekstual
// menggunakan AI untuk user yang sudah terhubung, atau mengirim panduan
// untuk user yang belum terhubung.
const CHAT_SYSTEM_PROMPT = `Kamu adalah asisten AI untuk Finepro, aplikasi keuangan keluarga Indonesia. Kamu mengobrol santai dengan pengguna lewat Telegram DAN bisa mengoreksi transaksi hasil scan.

FORMAT WAJIB — selalu respons sebagai JSON 1 baris:
{"action":"chat","reply":"<balasan HTML>"}

JIKA pengguna minta KOREKSI transaksi (nominal salah, kategori salah, tanggal, tipe, catatan) dan ada "Transaksi terakhir" di konteks, gunakan:
{"action":"edit","transaction_id":"<id>","changes":{...},"reply":"<konfirmasi HTML>"}
- changes hanya berisi field yang dikoreksi. Valid key: amount (angka), category (string), date (YYYY-MM-DD), type (income/expense), note (string).
- JANGAN mengarang transaction_id — pakai yang ada di konteks. Kalau tidak ada transaksi terakhir, arahkan ke web.
- Contoh: user bilang "nominalnya 50rb" → {"action":"edit","transaction_id":"abc-123","changes":{"amount":50000},"reply":"Siap Kak! Nominal sudah dikoreksi jadi <b>Rp50.000</b> ya ✅"}

GAYA PENULISAN (untuk field reply):
- Panggil "Kak <nama>". HTML: <b>bold</b>, <i>italic</i>. JANGAN pakai ** atau *.
- Emoji wajib: 😊🤗💡📸📊🎯✨🏠🛡️⚠️🙏💪🚀✅✏️ — tiap 1-2 kalimat.
- Paragraf pendek proporsional, nada hangat seperti teman ngobrol, akhiri semangat.

KONTEKS APLIKASI FINEPRO:
Finepro — aplikasi keuangan keluarga. Fitur: tambah transaksi, scan struk lewat bot, budget, tagihan, target tabungan (emas/perak), household, dashboard, multi-wallet, laporan bulanan. Web: https://finepro.my.id

Cara kerja bot: foto struk → pengeluaran, foto transfer → pemasukan, /start kode → hubungkan akun, teks → kamu jawab.

Masalah umum: scan gagal → pencahayaan lebih terang. Kuota habis → upgrade/web. Belum ada household → buat di web.`;

router.post('/chat', telegramServiceMiddleware, async (req, res) => {
  try {
    const { telegram_id, text, telegram_username } = req.body;
    if (!telegram_id || !text) {
      return res.status(400).json({ error: 'telegram_id dan text wajib diisi' });
    }

    // Cari user berdasarkan telegram_id
    const userResult = await pool.query(
      'SELECT id, name, email FROM users WHERE telegram_id = $1',
      [telegram_id]
    );
    const user = userResult.rows[0];

    if (!user) {
      // User belum terhubung — kasih panduan
      return res.json({
        reply: `Halo! 👋 Akun Telegram kamu belum terhubung ke Finepro.\n\nUntuk menghubungkan:\n1. Buka https://finepro.my.id\n2. Login ke akun kamu\n3. Buka menu Akun\n4. Klik "Hubungkan Telegram" dan ikuti langkahnya\n\nSetelah terhubung, kirim foto struk atau bukti transfer untuk otomatis dicatat 📸`,
        linked: false,
      });
    }

    // Cek AI config
    const aiConfig = await getSetting('ai');
    if (!isAiConfigured(aiConfig)) {
      // AI belum dikonfigurasi — fallback ke pesan bantuan statis
      return res.json({
        reply: `Hai ${user.name || user.email}! Saat ini asisten AI belum dikonfigurasi.\n\nYang bisa kamu lakukan:\n📸 Kirim foto struk/bukti transfer untuk otomatis dicatat\n📊 Buka https://finepro.my.id untuk kelola keuangan lengkap\n\nAda pertanyaan lain?`,
        linked: true,
        ai_available: false,
      });
    }

    // Bangun riwayat scan + transaksi terakhir untuk konteks edit
    const [recentResult, lastTxResult] = await Promise.all([
      pool.query(
        `SELECT doc_type, to_char(created_at, 'YYYY-MM-DD HH24:MI') as scan_time, status
         FROM telegram_receipts
         WHERE telegram_id = $1
         ORDER BY created_at DESC LIMIT 3`,
        [telegram_id]
      ),
      pool.query(
        `SELECT t.id, t.amount, t.category, t.type, to_char(t.date, 'YYYY-MM-DD') as date, t.note
         FROM transactions t
         JOIN telegram_receipts tr ON tr.transaction_id = t.id
         WHERE tr.telegram_id = $1 AND tr.status = 'success'
         ORDER BY t.created_at DESC LIMIT 1`,
        [telegram_id]
      ),
    ]);
    const recentScans = recentResult.rows;

    let scanContext = '';
    if (recentScans.length > 0) {
      const successCount = recentScans.filter(s => s.status === 'success').length;
      const failCount = recentScans.filter(s => s.status === 'failed').length;
      scanContext = `\n\nRiwayat scan: ${recentScans.length} scan (${successCount} berhasil, ${failCount} gagal).`;
      if (failCount > 0) {
        const lastFail = recentScans.find(s => s.status === 'failed');
        scanContext += ` Scan terakhir gagal pada ${lastFail?.scan_time}.`;
      }
    }

    const lastTx = lastTxResult.rows[0];
    if (lastTx) {
      const amountStr = new Intl.NumberFormat('id-ID').format(Number(lastTx.amount));
      scanContext += `\n\nTransaksi terakhir: ID=${lastTx.id}, ${lastTx.type === 'income' ? 'Pemasukan' : 'Pengeluaran'} Rp${amountStr}, ${lastTx.category}, ${lastTx.date}${lastTx.note ? ', catatan: ' + lastTx.note : ''}. Gunakan ID ini jika user minta koreksi.`;
    }

    const userName = user.name || user.email?.split('@')[0] || 'Pengguna';

    const aiResponse = await generateChatText({
      config: aiConfig,
      maxTokens: 400,
      temperature: 0.7,
      system: CHAT_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `User: ${userName}${scanContext}\n\nPertanyaan user: ${text}`,
      }],
    });

    // Post-process: parse JSON action, konversi Markdown → HTML
    const toHtml = (raw) => {
      let s = raw || '';
      s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
      s = s.replace(/__(.+?)__/g, '<b>$1</b>');
      s = s.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<i>$1</i>');
      s = s.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<i>$1</i>');
      return s;
    };

    const raw = aiResponse?.trim() || '';
    let reply;
    let action = null;

    // Coba parse baris pertama sebagai JSON action
    const firstLine = raw.split('\n')[0].trim();
    try {
      const parsed = JSON.parse(firstLine);
      if (parsed.action && parsed.reply) {
        action = parsed;
        reply = toHtml(parsed.reply);
      }
    } catch {
      // Bukan JSON — fallback ke plain text
    }

    // Jika bukan JSON action, perlakukan seluruh respons sebagai chat
    if (!action) {
      reply = toHtml(raw) || `Hai ${userName}! Maaf, aku belum bisa memahami pertanyaanmu. Coba tanyakan dengan kata kunci lain, atau buka https://finepro.my.id untuk bantuan lengkap.`;
    }

    // Eksekusi action edit
    let edited = false;
    if (action?.action === 'edit' && action.transaction_id && action.changes) {
      const txId = action.transaction_id;
      const changes = action.changes;

      // Validasi: transaksi milik user ini?
      const ownerCheck = await pool.query(
        `SELECT t.id FROM transactions t
         JOIN telegram_receipts tr ON tr.transaction_id = t.id
         WHERE t.id = $1 AND tr.telegram_id = $2`,
        [txId, telegram_id]
      );

      if (ownerCheck.rows.length > 0) {
        const setClauses = [];
        const values = [];
        let idx = 1;

        if (changes.amount !== undefined) {
          const amt = Number(changes.amount);
          if (amt > 0) {
            setClauses.push(`amount = $${idx++}`);
            values.push(amt);
          }
        }
        if (changes.category !== undefined && String(changes.category).trim()) {
          setClauses.push(`category = $${idx++}`);
          values.push(String(changes.category).trim());
        }
        if (changes.date !== undefined) {
          const d = new Date(changes.date);
          if (!isNaN(d.getTime())) {
            setClauses.push(`date = $${idx++}`);
            values.push(changes.date);
          }
        }
        if (changes.type !== undefined && ['income', 'expense'].includes(changes.type)) {
          setClauses.push(`type = $${idx++}`);
          values.push(changes.type);
        }
        if (changes.note !== undefined) {
          setClauses.push(`note = $${idx++}`);
          values.push(String(changes.note));
        }

        if (setClauses.length > 0) {
          values.push(txId);
          await pool.query(
            `UPDATE transactions SET ${setClauses.join(', ')} WHERE id = $${idx}`,
            values
          );
          edited = true;
        }
      }
    }

    res.json({
      reply: reply || 'Ada kendala nih. Coba lagi ya 🙏',
      linked: true,
      ai_available: true,
      ...(edited ? { edited: true } : {}),
    });
  } catch (err) {
    console.error('Telegram chat error:', err);
    // Fallback graceful — jangan return 500 ke n8n
    res.json({
      reply: 'Ada kendala teknis nih. Coba lagi sebentar ya, atau buka https://finepro.my.id untuk bantuan.',
      linked: false,
      ai_available: false,
    });
  }
});

export default router;
