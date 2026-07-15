// api/routes/whatsapp.js
// Integrasi WhatsApp Cloud API: user menghubungkan akun WhatsApp ke akun
// Finepro (link/start + auto-detect kode dari pesan WA), lalu foto struk/
// bukti transfer yang dikirim ke bot WA diproses langsung oleh endpoint ini
// (tanpa n8n — Meta push webhook langsung ke Finepro).

import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { getSetting } from '../services/appSettings.js';
import { generateChatText, isAiConfigured } from '../services/aiProvider.js';
import { normalizeTransactionCategory } from '../services/categoryMatcher.js';
import { extractText, tryRegexExtraction, parseReceiptText, sanitizeDate } from '../services/receiptExtraction.js';
import { checkBudgetThreshold } from '../services/transactionEffects.js';
import { assertQuotaAvailable, recordAiUsage, reserveUserDailyAiUsage } from '../services/aiUsage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'whatsapp');
const WA_API_URL = 'https://graph.facebook.com/v21.0';

const router = Router();

// ── Helpers ────────────────────────────────────────────────────

let _cachedWaSettings = null;
let _cachedWaSettingsAt = 0;
const WA_SETTINGS_TTL = 30_000; // 30 detik

async function getWaSettings() {
  const now = Date.now();
  if (_cachedWaSettings && (now - _cachedWaSettingsAt) < WA_SETTINGS_TTL) {
    return _cachedWaSettings;
  }
  _cachedWaSettings = await getSetting('whatsapp');
  _cachedWaSettingsAt = now;
  return _cachedWaSettings;
}

async function getWaToken() {
  const settings = await getWaSettings();
  return settings.token;
}

async function getPhoneNumberId() {
  const settings = await getWaSettings();
  return settings.phone_number_id;
}

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
  return String(crypto.randomInt(100000, 1000000));
}

// ── WhatsApp API helpers ────────────────────────────────────────

async function downloadWaMedia(mediaId) {
  const token = await getWaToken();
  if (!token) throw new Error('Token WhatsApp belum dikonfigurasi');

  // 1. Ambil metadata — Meta kasih URL download, bukan binary langsung
  const metaUrl = `${WA_API_URL}/${mediaId}`;
  const metaResp = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!metaResp.ok) {
    const errText = await metaResp.text().catch(() => '');
    throw new Error(`Gagal ambil metadata media WhatsApp: ${metaResp.status} ${errText.slice(0, 200)}`);
  }

  const meta = await metaResp.json();
  const downloadUrl = meta.url;
  if (!downloadUrl) {
    throw new Error('Media WhatsApp tidak memiliki URL download');
  }

  // 2. Download binary dari URL yang diberikan Meta
  const dlResp = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!dlResp.ok) {
    throw new Error(`Gagal download media WhatsApp: ${dlResp.status}`);
  }

  const contentType = dlResp.headers.get('content-type') || meta.mime_type || 'image/jpeg';
  const buffer = Buffer.from(await dlResp.arrayBuffer());
  return { buffer, mimetype: contentType, size: buffer.length };
}

async function sendWaMessage(to, text) {
  const token = await getWaToken();
  const phoneNumberId = await getPhoneNumberId();
  if (!token || !phoneNumberId) {
    console.error('WhatsApp sendMessage: token atau phone_number_id belum dikonfigurasi');
    return null;
  }

  const url = `${WA_API_URL}/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body: text },
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error('WhatsApp send error:', resp.status, JSON.stringify(result).slice(0, 500));
  }
  return result;
}

async function markWaAsRead(messageId) {
  const token = await getWaToken();
  const phoneNumberId = await getPhoneNumberId();
  if (!token || !phoneNumberId) return;

  const url = `${WA_API_URL}/${phoneNumberId}/messages`;
  await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    }),
  }).catch(() => {});
}

// ── Core: Process WhatsApp Receipt ──────────────────────────────

async function processWhatsAppReceipt({ whatsappId, imageBuffer, mimetype, caption }) {
  // Lookup user by whatsapp_id
  const userResult = await pool.query(
    'SELECT id FROM users WHERE whatsapp_id = $1',
    [whatsappId]
  );
  const user = userResult.rows[0];
  if (!user) {
    return {
      status: 'unlinked',
      message: 'Akun WhatsApp kamu belum terhubung ke Finepro.\n\nUntuk menghubungkan:\n1. Buka https://finepro.my.id\n2. Login ke akun kamu\n3. Buka menu Akun\n4. Klik "Hubungkan WhatsApp" dan ikuti langkahnya',
    };
  }

  const householdId = await getUserHouseholdId(user.id);
  if (!householdId) {
    return {
      status: 'no_household',
      message: 'Akun kamu belum tergabung di household manapun di finepro.my.id.',
    };
  }

  // Quota check
  try {
    await assertQuotaAvailable(householdId, 'receipt_scan', 'Kuota scan otomatis');
  } catch (quotaErr) {
    return {
      status: 'quota_exceeded',
      message: `${quotaErr.message} Catat manual dulu di web, atau upgrade paket.`,
    };
  }

  const aiConfig = await getSetting('ai');

  // OCR
  let rawText;
  try {
    rawText = await extractText(imageBuffer);
  } catch (ocrErr) {
    console.error('WhatsApp OCR error:', ocrErr);
    await pool.query(
      `INSERT INTO whatsapp_receipts (household_id, created_by, whatsapp_id, raw_text, status, error_message)
       VALUES ($1, $2, $3, $4, 'failed', $5)`,
      [householdId, user.id, whatsappId, '', 'Gagal membaca teks dari gambar']
    );
    return {
      status: 'ocr_failed',
      message: 'Foto tidak terbaca. Coba foto ulang dengan pencahayaan lebih terang dan pastikan teks terlihat jelas.',
    };
  }

  // Parse — regex dulu, fallback ke AI
  let parsed = tryRegexExtraction(rawText);
  let usedAi = false;

  if (!parsed) {
    if (!isAiConfigured(aiConfig)) {
      return {
        status: 'ai_not_configured',
        message: 'Foto tidak bisa dibaca otomatis dan fitur AI belum dikonfigurasi. Catat manual dulu di web.',
      };
    }
    try {
      usedAi = true;
      parsed = await parseReceiptText(rawText, { aiConfig });
    } catch (parseErr) {
      console.error('WhatsApp AI parse error:', parseErr);
      await recordAiUsage({
        householdId,
        userId: user.id,
        feature: 'receipt_scan',
        source: 'whatsapp',
        usedAi,
        provider: aiConfig.provider || null,
        model: aiConfig.sumopod_model || aiConfig.anthropic_model || aiConfig.model || null,
        metadata: { status: 'failed', reason: 'ai_parse_error', whatsapp_id: whatsappId },
      });
      await pool.query(
        `INSERT INTO whatsapp_receipts (household_id, created_by, whatsapp_id, raw_text, status, error_message)
         VALUES ($1, $2, $3, $4, 'failed', $5)`,
        [householdId, user.id, whatsappId, rawText, 'Gagal membaca hasil dari AI']
      );
      return {
        status: 'parse_failed',
        message: 'Foto tidak terbaca dengan jelas. Coba foto ulang dengan pencahayaan lebih baik, atau catat manual di web.',
      };
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
      source: 'whatsapp',
      usedAi,
      provider: usedAi ? aiConfig.provider : null,
      model: usedAi ? (aiConfig.sumopod_model || aiConfig.anthropic_model || aiConfig.model || null) : null,
      metadata: { status: 'failed', reason: 'amount_not_found', whatsapp_id: whatsappId },
    });
    await pool.query(
      `INSERT INTO whatsapp_receipts (household_id, created_by, whatsapp_id, doc_type, raw_text, extracted, status, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, 'failed', $7)`,
      [householdId, user.id, whatsappId, docType, rawText, JSON.stringify(parsed), 'Nominal tidak terbaca']
    );
    return {
      status: 'amount_not_found',
      message: 'Nominal di foto tidak terbaca. Coba foto yang lebih jelas, atau catat manual di web.',
    };
  }

  // Simpan gambar
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${crypto.randomUUID()}.jpg`;
  const imagePath = path.join(UPLOAD_DIR, filename);
  await fs.writeFile(imagePath, imageBuffer);
  const publicImagePath = `/uploads/whatsapp/${filename}`;

  const walletId = await resolveDefaultWalletId(householdId);

  // Insert transaksi
  const txResult = await pool.query(
    `INSERT INTO transactions (household_id, created_by, date, type, category, amount, note, wallet_id, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'whatsapp')
     RETURNING id, to_char(date, 'YYYY-MM-DD') as date, type, category, amount, note`,
    [householdId, user.id, date, type, category, amount, note, walletId]
  );
  const transaction = txResult.rows[0];

  if (type === 'expense') {
    checkBudgetThreshold(householdId, category, date, amount).catch((err) =>
      console.error('WhatsApp budget threshold check error:', err)
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
    source: 'whatsapp',
    usedAi,
    provider: usedAi ? aiConfig.provider : null,
    model: usedAi ? (aiConfig.sumopod_model || aiConfig.anthropic_model || aiConfig.model || null) : null,
    metadata: { status: 'success', parser: parsed.source || (usedAi ? 'ai' : 'regex'), whatsapp_id: whatsappId, transaction_id: transaction.id },
  });
  await pool.query(
    `INSERT INTO whatsapp_receipts (household_id, created_by, whatsapp_id, doc_type, image_path, raw_text, extracted, transaction_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'success')`,
    [householdId, user.id, whatsappId, docType, publicImagePath, rawText, JSON.stringify(parsed), transaction.id]
  );

  const typeLabel = type === 'income' ? 'Pemasukan' : 'Pengeluaran';
  const amountLabel = new Intl.NumberFormat('id-ID').format(amount);

  return {
    status: 'success',
    transaction,
    message: `Tercatat: ${typeLabel} Rp${amountLabel} — ${category}${note ? ` (${note})` : ''} pada ${date}.`,
  };
}

// ── Link Endpoints (untuk web frontend) ─────────────────────────

// POST /api/whatsapp/link/start — user login web minta kode
router.post('/link/start', authMiddleware, async (req, res) => {
  try {
    const code = generateLinkCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      'INSERT INTO whatsapp_link_codes (code, user_id, expires_at) VALUES ($1, $2, $3)',
      [code, req.user.userId, expiresAt]
    );

    const waSettings = await getWaSettings();
    const waPhone = waSettings.business_phone || 'belum dikonfigurasi';

    res.json({
      code,
      expires_at: expiresAt.toISOString(),
      wa_phone: waPhone,
      instructions: `Kirim kode ${code} ke nomor WhatsApp ${waPhone} untuk menghubungkan akun.`,
    });
  } catch (err) {
    console.error('WhatsApp link start error:', err);
    res.status(500).json({ error: 'Gagal membuat kode hubung WhatsApp' });
  }
});

// DELETE /api/whatsapp/link — user login web putus koneksi WA
router.delete('/link', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE users
       SET whatsapp_id = NULL
       WHERE id = $1
       RETURNING id, email, name, avatar_url, role, created_at, whatsapp_id`,
      [req.user.userId]
    );

    await pool.query(
      'UPDATE whatsapp_link_codes SET used_at = now() WHERE user_id = $1 AND used_at IS NULL',
      [req.user.userId]
    );

    const user = result.rows[0];
    res.json({ user, message: 'Akun WhatsApp berhasil diputuskan' });
  } catch (err) {
    console.error('WhatsApp unlink error:', err);
    res.status(500).json({ error: 'Gagal memutus koneksi WhatsApp' });
  }
});

// ── Webhook ─────────────────────────────────────────────────────

// GET /api/whatsapp/webhook — verifikasi webhook (dipanggil Meta)
router.get('/webhook', async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const waSettings = await getWaSettings();
  const expectedToken = waSettings.verify_token;

  if (mode === 'subscribe' && token === expectedToken && expectedToken) {
    console.log('WhatsApp webhook verified');
    return res.status(200).send(challenge);
  }

  console.warn('WhatsApp webhook verification failed');
  return res.sendStatus(403);
});

// POST /api/whatsapp/webhook — terima pesan dari Meta
router.post('/webhook', async (req, res) => {
  // Selalu return 200 ke Meta secepat mungkin — proses async setelahnya
  res.status(200).json({ status: 'ok' });

  try {
    const body = req.body;

    // Parse payload Meta
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value?.messages) {
      return; // bukan pesan (status update, dll) — abaikan
    }

    const message = value.messages[0];
    const contact = value.contacts?.[0];
    const waId = message.from;
    const msgType = message.type;
    const msgId = message.id;

    if (!waId || !msgType) return;

    // Abaikan pesan dari nomor bisnis sendiri (mencegah loop)
    const waSettings = await getWaSettings();
    const businessPhone = waSettings.business_phone;
    if (businessPhone && waId === businessPhone) {
      console.log('WhatsApp: abaikan pesan dari nomor sendiri');
      return;
    }

    // 1. Handle gambar → receipt scanning
    if (msgType === 'image') {
      const mediaId = message.image?.id;
      const caption = message.image?.caption || '';

      if (!mediaId) return;

      let imageData;
      try {
        imageData = await downloadWaMedia(mediaId);
      } catch (downloadErr) {
        console.error('WhatsApp media download error:', downloadErr);
        await sendWaMessage(waId, 'Gagal mengunduh gambar. Coba kirim ulang fotonya ya.');
        return;
      }

      const result = await processWhatsAppReceipt({
        whatsappId: waId,
        imageBuffer: imageData.buffer,
        mimetype: imageData.mimetype,
        caption,
      });

      await sendWaMessage(waId, result.message);
      return;
    }

    // 2. Handle teks
    if (msgType === 'text') {
      const text = (message.text?.body || '').trim();
      if (!text) return;

      // 2a. Deteksi kode linking (6 digit numerik)
      const linkCodeMatch = text.match(/^\d{6}$/);
      if (linkCodeMatch) {
        const code = linkCodeMatch[0];

        const linkResult = await pool.query(
          `SELECT user_id FROM whatsapp_link_codes
           WHERE code = $1 AND used_at IS NULL AND expires_at > now()`,
          [code]
        );
        const link = linkResult.rows[0];

        if (!link) {
          await sendWaMessage(
            waId,
            'Kode tidak valid atau sudah kedaluwarsa. Buka kembali halaman Akun di finepro.my.id untuk minta kode baru.'
          );
          return;
        }

        // Cek apakah whatsapp_id ini sudah dipakai akun lain
        const existing = await pool.query(
          'SELECT id, name FROM users WHERE whatsapp_id = $1',
          [waId]
        );
        if (existing.rows[0]) {
          await sendWaMessage(
            waId,
            `Nomor WhatsApp ini sudah terhubung ke akun ${existing.rows[0].name || existing.rows[0].id}. Hubungi pemilik akun kalau ini keliru.`
          );
          return;
        }

        await pool.query(
          'UPDATE users SET whatsapp_id = $1 WHERE id = $2',
          [waId, link.user_id]
        );
        await pool.query('UPDATE whatsapp_link_codes SET used_at = now() WHERE code = $1', [code]);

        const userResult = await pool.query('SELECT name, email FROM users WHERE id = $1', [link.user_id]);
        const user = userResult.rows[0];

        await sendWaMessage(
          waId,
          `Akun WhatsApp berhasil terhubung ke ${user?.name || user?.email}! 🎉\n\nSekarang kamu bisa kirim foto struk belanja atau bukti transfer untuk otomatis dicatat.\n\nContoh:\n📸 Foto struk → tercatat sebagai pengeluaran\n📸 Foto bukti transfer → tercatat sebagai pemasukan`
        );
        return;
      }

      // 2b. Chat AI — cek user sudah terhubung
      const userResult = await pool.query(
        'SELECT id, name, email FROM users WHERE whatsapp_id = $1',
        [waId]
      );
      const user = userResult.rows[0];

      if (!user) {
        await sendWaMessage(
          waId,
          'Halo! 👋 Akun WhatsApp kamu belum terhubung ke Finepro.\n\nUntuk menghubungkan:\n1. Buka https://finepro.my.id\n2. Login ke akun kamu\n3. Buka menu Akun\n4. Klik "Hubungkan WhatsApp" dan ikuti langkahnya\n\nSetelah terhubung, kirim foto struk atau bukti transfer untuk otomatis dicatat 📸'
        );
        return;
      }

      const householdId = await getUserHouseholdId(user.id);
      if (!householdId) {
        await sendWaMessage(
          waId,
          `Hai ${user.name || user.email}! Akun kamu belum tergabung di household manapun.\n\nBuka https://finepro.my.id dulu untuk membuat atau bergabung ke household.`
        );
        return;
      }

      // Cek AI config
      const aiConfig = await getSetting('ai');
      const userName = user.name || user.email?.split('@')[0] || 'Pengguna';

      if (!isAiConfigured(aiConfig)) {
        await sendWaMessage(
          waId,
          `Hai ${userName}! Saat ini asisten AI belum dikonfigurasi.\n\nYang bisa kamu lakukan:\n📸 Kirim foto struk/bukti transfer untuk otomatis dicatat\n📊 Buka https://finepro.my.id untuk kelola keuangan lengkap`
        );
        return;
      }

      // AI quota check
      try {
        await reserveUserDailyAiUsage({
          householdId,
          userId: user.id,
          feature: 'whatsapp_chat',
          source: 'whatsapp',
          usedAi: true,
          provider: aiConfig.provider || null,
          model: aiConfig.sumopod_model || aiConfig.anthropic_model || aiConfig.model || null,
          metadata: { status: 'accepted', whatsapp_id: waId, text_length: text.length },
          label: 'Kuota chat AI WhatsApp',
        });
      } catch (quotaErr) {
        await sendWaMessage(
          waId,
          `${quotaErr.message || 'Kuota chat AI WhatsApp hari ini sudah habis.'}\n\nKamu masih bisa kirim foto struk/bukti transfer jika kuota scan masih tersedia, atau coba chat lagi besok 😊`
        );
        return;
      }

      // Ambil riwayat scan & transaksi terakhir untuk konteks
      const [recentResult, lastTxResult] = await Promise.all([
        pool.query(
          `SELECT doc_type, to_char(created_at, 'YYYY-MM-DD HH24:MI') as scan_time, status
           FROM whatsapp_receipts
           WHERE whatsapp_id = $1
           ORDER BY created_at DESC LIMIT 3`,
          [waId]
        ),
        pool.query(
          `SELECT t.id, t.amount, t.category, t.type, to_char(t.date, 'YYYY-MM-DD') as date, t.note
           FROM transactions t
           JOIN whatsapp_receipts wr ON wr.transaction_id = t.id
           WHERE wr.whatsapp_id = $1 AND wr.status = 'success'
           ORDER BY t.created_at DESC LIMIT 1`,
          [waId]
        ),
      ]);

      const recentScans = recentResult.rows;
      let scanContext = '';
      if (recentScans.length > 0) {
        const successCount = recentScans.filter(s => s.status === 'success').length;
        const failCount = recentScans.filter(s => s.status === 'failed').length;
        scanContext = `\n\nRiwayat scan: ${recentScans.length} scan (${successCount} berhasil, ${failCount} gagal).`;
      }

      const lastTx = lastTxResult.rows[0];
      if (lastTx) {
        const amountStr = new Intl.NumberFormat('id-ID').format(Number(lastTx.amount));
        scanContext += `\n\nTransaksi terakhir: ID=${lastTx.id}, ${lastTx.type === 'income' ? 'Pemasukan' : 'Pengeluaran'} Rp${amountStr}, ${lastTx.category}, ${lastTx.date}${lastTx.note ? ', catatan: ' + lastTx.note : ''}. Gunakan ID ini jika user minta koreksi.`;
      }

      const aiResponse = await generateChatText({
        config: aiConfig,
        maxTokens: 400,
        temperature: 0.7,
        system: WHATSAPP_CHAT_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `User: ${userName}${scanContext}\n\nPertanyaan user: ${text}`,
        }],
      });

      const raw = aiResponse?.trim() || '';
      let reply;
      let action = null;

      const firstLine = raw.split('\n')[0].trim();
      try {
        const parsed = JSON.parse(firstLine);
        if (parsed.action && parsed.reply) {
          action = parsed;
          reply = toHtml(parsed.reply);
        }
      } catch {
        // bukan JSON — plain text
      }

      if (!action) {
        reply = toHtml(raw) || `Hai ${userName}! Maaf, aku belum bisa memahami pertanyaanmu. Coba tanyakan dengan kata kunci lain, atau buka https://finepro.my.id untuk bantuan lengkap.`;
      }

      // Eksekusi edit jika ada
      let edited = false;
      if (action?.action === 'edit' && action.transaction_id && action.changes) {
        const ownerCheck = await pool.query(
          `SELECT t.id FROM transactions t
           JOIN whatsapp_receipts wr ON wr.transaction_id = t.id
           WHERE t.id = $1 AND wr.whatsapp_id = $2`,
          [action.transaction_id, waId]
        );

        if (ownerCheck.rows.length > 0) {
          const changes = action.changes;
          const setClauses = [];
          const values = [];
          let idx = 1;

          if (changes.amount !== undefined) {
            const amt = Number(changes.amount);
            if (amt > 0) { setClauses.push(`amount = $${idx++}`); values.push(amt); }
          }
          if (changes.category !== undefined && String(changes.category).trim()) {
            setClauses.push(`category = $${idx++}`);
            values.push(String(changes.category).trim());
          }
          if (changes.date !== undefined) {
            const d = new Date(changes.date);
            if (!isNaN(d.getTime())) { setClauses.push(`date = $${idx++}`); values.push(changes.date); }
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
            values.push(action.transaction_id);
            await pool.query(
              `UPDATE transactions SET ${setClauses.join(', ')} WHERE id = $${idx}`,
              values
            );
            edited = true;
          }
        }
      }

      await sendWaMessage(waId, reply || 'Ada kendala nih. Coba lagi ya 🙏');
    }

  } catch (err) {
    console.error('WhatsApp webhook error:', err);
    // Jangan throw — webhook udah di-ACK
  }
});

// ── Post-processors ─────────────────────────────────────────────

function toHtml(raw) {
  let s = raw || '';
  s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  s = s.replace(/__(.+?)__/g, '<b>$1</b>');
  s = s.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<i>$1</i>');
  s = s.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<i>$1</i>');
  return s;
}

// ── AI System Prompt ────────────────────────────────────────────

const WHATSAPP_CHAT_SYSTEM_PROMPT = `Kamu adalah asisten AI untuk Finepro, aplikasi keuangan keluarga Indonesia. Kamu mengobrol santai dengan pengguna lewat WhatsApp DAN bisa mengoreksi transaksi hasil scan.

FORMAT WAJIB — selalu respons sebagai JSON 1 baris:
{"action":"chat","reply":"<balasan teks>"}

JIKA pengguna minta KOREKSI transaksi (nominal salah, kategori salah, tanggal, tipe, catatan) dan ada "Transaksi terakhir" di konteks, gunakan:
{"action":"edit","transaction_id":"<id>","changes":{...},"reply":"<konfirmasi>"}
- changes hanya berisi field yang dikoreksi. Valid key: amount (angka), category (string), date (YYYY-MM-DD), type (income/expense), note (string).
- JANGAN mengarang transaction_id — pakai yang ada di konteks.

GAYA PENULISAN (untuk field reply):
- Panggil "Kak <nama>" di awal. Nada hangat seperti teman ngobrol, bukan CS kaku.
- Emoji wajib: 😊🤗💡📸📊🎯✨🏠🛡️⚠️🙏💪🚀✅✏️ — tiap 1-2 kalimat.
- Paragraf pendek proporsional. Akhiri dengan semangat.
- JANGAN pakai format Markdown (**bold**, *italic*) — WhatsApp tidak render Markdown. Gunakan teks polos dengan emoji sebagai pemisah alami.

KONTEKS APLIKASI FINEPRO:
Finepro — aplikasi keuangan keluarga. Fitur: tambah transaksi, scan struk lewat bot, budget, tagihan, target tabungan (emas/perak), household, dashboard, multi-wallet, laporan bulanan. Web: https://finepro.my.id

Cara kerja bot WA: foto struk → pengeluaran, foto transfer → pemasukan, kode 6 digit → hubungkan akun, teks → kamu jawab.

Masalah umum: scan gagal → pencahayaan lebih terang. Kuota habis → upgrade/web. Belum ada household → buat di web.`;

export default router;
