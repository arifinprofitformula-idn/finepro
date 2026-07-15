import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import midtransClient from 'midtrans-client';
import multer from 'multer';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { getSetting } from '../services/appSettings.js';
import { addSubscriberToList } from '../services/mailer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROOF_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'payment-proofs');

const router = Router();

export const PLANS = {
  monthly: { amount: 29000, months: 1, label: 'Bulanan' },
  semiannual: { amount: 149000, months: 6, label: '6 Bulan' },
  annual: { amount: 249000, months: 12, label: 'Tahunan' },
};

const proofUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!/^image\/(png|jpe?g|webp)$/.test(file.mimetype)) {
      return cb(new Error('Format bukti transfer harus PNG, JPG, atau WEBP'));
    }
    cb(null, true);
  },
});

async function getActiveGateway() {
  const config = await getSetting('payment_gateway');
  return config.active || 'midtrans';
}

async function getOwnerHouseholdId(userId) {
  const result = await pool.query(
    `SELECT household_id FROM household_members WHERE user_id = $1 AND role = 'owner' LIMIT 1`,
    [userId]
  );
  return result.rows[0]?.household_id || null;
}

async function getUserHouseholdId(userId) {
  const result = await pool.query(
    'SELECT household_id FROM household_members WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  return result.rows[0]?.household_id || null;
}

// Rumus signature Midtrans: SHA512(order_id + status_code + gross_amount + ServerKey)
// https://docs.midtrans.com/docs/https-notification-webhooks
async function getMidtransConfig() {
  const config = await getSetting('midtrans');
  if (!config.enabled || !config.server_key || !config.client_key) {
    throw new Error('Midtrans belum dikonfigurasi');
  }
  return config;
}

async function getMidtransSnap() {
  const config = await getMidtransConfig();
  return new midtransClient.Snap({
    isProduction: config.is_production === true,
    serverKey: config.server_key,
    clientKey: config.client_key,
  });
}

async function getMidtransCoreApi() {
  const config = await getMidtransConfig();
  return new midtransClient.CoreApi({
    isProduction: config.is_production === true,
    serverKey: config.server_key,
    clientKey: config.client_key,
  });
}

async function verifyMidtransSignature(body) {
  const { order_id, status_code, gross_amount, signature_key } = body || {};
  if (!order_id || !status_code || !gross_amount || !signature_key) return false;

  const config = await getSetting('midtrans');
  const raw = `${order_id}${status_code}${gross_amount}${config.server_key}`;
  const expected = crypto.createHash('sha512').update(raw).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature_key), Buffer.from(expected));
  } catch {
    return false;
  }
}

async function getXenditConfig() {
  const config = await getSetting('xendit');
  if (!config.enabled || !config.secret_key) {
    throw new Error('Xendit belum dikonfigurasi');
  }
  return config;
}

async function xenditRequest(method, urlPath, body) {
  const config = await getXenditConfig();
  const auth = Buffer.from(`${config.secret_key}:`).toString('base64');
  const response = await fetch(`https://api.xendit.co${urlPath}`, {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || 'Permintaan ke Xendit gagal');
  }
  return data;
}

async function createXenditInvoice(orderId, planConfig, user) {
  return xenditRequest('POST', '/v2/invoices', {
    external_id: orderId,
    amount: planConfig.amount,
    payer_email: user.email,
    description: `Langganan Keuangan Keluarga — ${planConfig.label}`,
    success_redirect_url: process.env.APP_BASE_URL ? `${process.env.APP_BASE_URL}/payment/finish?order_id=${orderId}` : undefined,
  });
}

async function getXenditInvoiceStatus(orderId) {
  const invoices = await xenditRequest('GET', `/v2/invoices?external_id=${encodeURIComponent(orderId)}`);
  return invoices?.[0] || null;
}

async function verifyXenditCallback(req) {
  const token = req.headers['x-callback-token'];
  if (!token) return false;
  const config = await getSetting('xendit');
  if (!config.callback_verification_token) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(config.callback_verification_token));
  } catch {
    return false;
  }
}

function mapXenditStatus(status) {
  if (status === 'PAID' || status === 'SETTLED') return 'paid';
  if (status === 'EXPIRED') return 'failed';
  return 'pending';
}

function mapMidtransStatus(transactionStatus, fraudStatus) {
  const isPaid = transactionStatus === 'settlement' ||
    (transactionStatus === 'capture' && fraudStatus === 'accept');
  const isFailed = ['deny', 'cancel', 'expire', 'failure'].includes(transactionStatus);

  if (isPaid) return 'paid';
  if (isFailed) return 'failed';
  return 'pending';
}

async function moveNewSubscriberToPaidList(householdId) {
  const mailketing = await getSetting('mailketing');
  if (!mailketing.paid_list_id) return;

  const result = await pool.query(
    `SELECT u.email, u.name FROM users u
     JOIN households h ON h.owner_id = u.id
     WHERE h.id = $1`,
    [householdId]
  );
  const owner = result.rows[0];
  if (!owner?.email) return;

  await addSubscriberToList({ email: owner.email, name: owner.name, listId: mailketing.paid_list_id });
}

export async function applyPaymentStatus(payment, nextStatus) {
  if (!payment || payment.status === 'paid' || nextStatus === 'pending') {
    return payment?.status || 'pending';
  }

  if (nextStatus === 'paid') {
    const planConfig = PLANS[payment.plan];
    if (!planConfig) throw new Error(`Plan pembayaran tidak valid: ${payment.plan}`);

    const client = await pool.connect();
    let wasTrial = false;
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE payments SET status = 'paid', paid_at = COALESCE(paid_at, now()) WHERE order_id = $1`,
        [payment.order_id]
      );
      const before = await client.query('SELECT plan FROM subscriptions WHERE household_id = $1', [payment.household_id]);
      wasTrial = before.rows[0]?.plan === 'trial';
      // Kalau masih ada sisa masa aktif, perpanjang dari situ; kalau tidak, mulai dari sekarang.
      await client.query(
        `UPDATE subscriptions
         SET plan = $1,
             status = 'active',
             current_period_end = GREATEST(COALESCE(current_period_end, CURRENT_DATE), CURRENT_DATE) + ($2 || ' months')::interval,
             updated_at = now()
         WHERE household_id = $3`,
        [payment.plan, planConfig.months, payment.household_id]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Transisi trial → berlangganan pertama kali — pindahkan ke list Mailketing
    // khusus subscriber berbayar (best-effort, tidak menggagalkan pembayaran).
    // Renewal tidak memicu ulang karena plan sebelumnya sudah bukan 'trial'.
    if (wasTrial) {
      moveNewSubscriberToPaidList(payment.household_id).catch((err) =>
        console.error('Gagal memindahkan subscriber ke list Mailketing paid:', err)
      );
    }

    return 'paid';
  }

  if (nextStatus === 'failed') {
    await pool.query(`UPDATE payments SET status = 'failed' WHERE order_id = $1`, [payment.order_id]);
    return 'failed';
  }

  return payment.status;
}

async function syncPaymentFromMidtrans(payment) {
  if (!payment || payment.status !== 'pending') return payment;

  try {
    const coreApi = await getMidtransCoreApi();
    const status = await coreApi.transaction.status(payment.order_id);
    const nextStatus = mapMidtransStatus(status.transaction_status, status.fraud_status);
    const appliedStatus = await applyPaymentStatus(payment, nextStatus);
    return {
      ...payment,
      status: appliedStatus,
      paid_at: appliedStatus === 'paid' ? (payment.paid_at || new Date().toISOString()) : payment.paid_at,
    };
  } catch (err) {
    // Status API bisa belum mengenali order beberapa detik pertama. Polling frontend
    // tetap berjalan, dan webhook masih menjadi sumber kebenaran utama.
    console.warn(`[payments status] Gagal sinkron ke Midtrans untuk ${payment.order_id}:`, err.message);
    return payment;
  }
}

async function syncPaymentFromXendit(payment) {
  if (!payment || payment.status !== 'pending') return payment;

  try {
    const invoice = await getXenditInvoiceStatus(payment.order_id);
    if (!invoice) return payment;
    const nextStatus = mapXenditStatus(invoice.status);
    const appliedStatus = await applyPaymentStatus(payment, nextStatus);
    return {
      ...payment,
      status: appliedStatus,
      paid_at: appliedStatus === 'paid' ? (payment.paid_at || new Date().toISOString()) : payment.paid_at,
    };
  } catch (err) {
    console.warn(`[payments status] Gagal sinkron ke Xendit untuk ${payment.order_id}:`, err.message);
    return payment;
  }
}

// POST /api/payments/create — buat transaksi sesuai gateway aktif (Midtrans atau Xendit)
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { plan } = req.body;
    const planConfig = PLANS[plan];
    if (!planConfig) {
      return res.status(400).json({ error: 'Plan tidak valid' });
    }

    const activeGateway = await getActiveGateway();
    if (activeGateway === 'manual') {
      return res.status(400).json({ error: 'Metode aktif saat ini adalah transfer manual. Gunakan /api/payments/manual/submit.' });
    }

    const householdId = await getOwnerHouseholdId(req.user.userId);
    if (!householdId) {
      return res.status(403).json({ error: 'Hanya pemilik household yang bisa mengubah langganan' });
    }

    const userResult = await pool.query('SELECT name, email FROM users WHERE id = $1', [req.user.userId]);
    const user = userResult.rows[0];

    const orderId = `SUB-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    if (activeGateway === 'xendit') {
      await pool.query(
        `INSERT INTO payments (household_id, order_id, plan, amount, status, method)
         VALUES ($1, $2, $3, $4, 'pending', 'xendit')`,
        [householdId, orderId, plan, planConfig.amount]
      );
      const invoice = await createXenditInvoice(orderId, planConfig, user);
      return res.status(201).json({ orderId, invoiceUrl: invoice.invoice_url });
    }

    // Default: midtrans
    const snap = await getMidtransSnap();
    await pool.query(
      `INSERT INTO payments (household_id, order_id, plan, amount, status, method)
       VALUES ($1, $2, $3, $4, 'pending', 'midtrans')`,
      [householdId, orderId, plan, planConfig.amount]
    );

    const transaction = await snap.createTransaction({
      transaction_details: {
        order_id: orderId,
        gross_amount: planConfig.amount,
      },
      customer_details: {
        first_name: user.name || user.email,
        email: user.email,
      },
      item_details: [{
        id: plan,
        price: planConfig.amount,
        quantity: 1,
        name: `Langganan Keuangan Keluarga — ${planConfig.label}`,
      }],
      callbacks: process.env.APP_BASE_URL ? {
        finish: `${process.env.APP_BASE_URL}/payment/finish?order_id=${orderId}`,
      } : undefined,
    });

    res.status(201).json({
      orderId,
      token: transaction.token,
      redirectUrl: transaction.redirect_url,
    });
  } catch (err) {
    console.error('Create payment error:', err);
    res.status(500).json({ error: 'Gagal membuat transaksi pembayaran' });
  }
});

// POST /api/payments/manual/submit — user klaim sudah transfer manual + upload bukti
router.post('/manual/submit', authMiddleware, (req, res) => {
  proofUpload.single('proof')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Gagal membaca bukti transfer' });
    }
    try {
      const { plan, reference, note } = req.body;
      const planConfig = PLANS[plan];
      if (!planConfig) {
        return res.status(400).json({ error: 'Plan tidak valid' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'Bukti transfer wajib diunggah' });
      }

      const manualConfig = await getSetting('manual_payment');
      if (!manualConfig.enabled) {
        return res.status(400).json({ error: 'Metode transfer manual belum aktif' });
      }

      const householdId = await getOwnerHouseholdId(req.user.userId);
      if (!householdId) {
        return res.status(403).json({ error: 'Hanya pemilik household yang bisa mengubah langganan' });
      }

      await fs.mkdir(PROOF_UPLOAD_DIR, { recursive: true });
      const ext = req.file.mimetype === 'image/png' ? 'png' : req.file.mimetype === 'image/webp' ? 'webp' : 'jpg';
      const filename = `${crypto.randomUUID()}.${ext}`;
      await fs.writeFile(path.join(PROOF_UPLOAD_DIR, filename), req.file.buffer);
      const proofUrl = `/uploads/payment-proofs/${filename}`;

      const orderId = `MANUAL-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      await pool.query(
        `INSERT INTO payments (household_id, order_id, plan, amount, status, method, proof_url, reference, note)
         VALUES ($1, $2, $3, $4, 'pending', 'manual', $5, $6, $7)`,
        [householdId, orderId, plan, planConfig.amount, proofUrl, reference || null, note || null]
      );

      res.status(201).json({ payment: { order_id: orderId, plan, amount: planConfig.amount, status: 'pending', method: 'manual' } });
    } catch (err) {
      console.error('Submit manual payment error:', err);
      res.status(500).json({ error: 'Gagal mengirim klaim pembayaran manual' });
    }
  });
});

// GET /api/payments/status/:orderId — dipoll frontend setelah redirect balik dari gateway
router.get('/status/:orderId', authMiddleware, async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    const result = await pool.query(
      'SELECT household_id, order_id, plan, amount, status, method, created_at, paid_at FROM payments WHERE order_id = $1 AND household_id = $2',
      [req.params.orderId, householdId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    }
    let payment = result.rows[0];
    if (payment.method === 'midtrans') {
      payment = await syncPaymentFromMidtrans(payment);
    } else if (payment.method === 'xendit') {
      payment = await syncPaymentFromXendit(payment);
    }
    delete payment.household_id;
    res.json({ payment });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil status pembayaran' });
  }
});

// GET /api/payments/history — riwayat pembayaran household user yang login
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.json({ payments: [] });

    const result = await pool.query(
      `SELECT order_id, plan, amount, status, method, created_at, paid_at
       FROM payments
       WHERE household_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [householdId]
    );
    res.json({ payments: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil riwayat pembayaran' });
  }
});

// GET /api/payments/methods — metode pembayaran aktif untuk tampilan user
router.get('/methods', authMiddleware, async (req, res) => {
  try {
    const [active, midtrans, xendit, manual] = await Promise.all([
      getActiveGateway(),
      getSetting('midtrans'),
      getSetting('xendit'),
      getSetting('manual_payment'),
    ]);
    const midtransEnabled = Boolean(midtrans.enabled && midtrans.server_key && midtrans.client_key);
    const xenditEnabled = Boolean(xendit.enabled && xendit.secret_key);
    res.json({
      active,
      methods: {
        midtrans: {
          enabled: active === 'midtrans' && midtransEnabled,
          clientKey: active === 'midtrans' && midtransEnabled ? midtrans.client_key : '',
          isProduction: midtrans.is_production === true,
          snapUrl: midtrans.is_production === true
            ? 'https://app.midtrans.com/snap/snap.js'
            : 'https://app.sandbox.midtrans.com/snap/snap.js',
        },
        xendit: {
          enabled: active === 'xendit' && xenditEnabled,
          isProduction: xendit.is_production === true,
        },
        manual: {
          enabled: active === 'manual' && Boolean(manual.enabled),
          bank_name: manual.bank_name || '',
          account_number: manual.account_number || '',
          account_name: manual.account_name || '',
          instructions: manual.instructions || '',
        }
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil metode pembayaran' });
  }
});

async function handleMidtransNotification(req, res) {
  try {
    if (!(await verifyMidtransSignature(req.body))) {
      console.warn('[payments notification] Signature tidak valid, payload ditolak.');
      return res.status(403).json({ error: 'Invalid signature' });
    }

    const { order_id, transaction_status, fraud_status } = req.body;

    const paymentResult = await pool.query('SELECT * FROM payments WHERE order_id = $1', [order_id]);
    const payment = paymentResult.rows[0];
    if (!payment) {
      console.warn(`[payments webhook] order_id tidak dikenal: ${order_id}`);
      return res.status(404).json({ error: 'Order tidak ditemukan' });
    }

    // Idempotent: Midtrans bisa mengirim notifikasi lebih dari sekali untuk order yang sama
    if (payment.status === 'paid') {
      return res.json({ received: true, alreadyProcessed: true });
    }

    const nextStatus = mapMidtransStatus(transaction_status, fraud_status);
    const appliedStatus = await applyPaymentStatus(payment, nextStatus);

    if (appliedStatus === 'paid') {
      console.log(`[payments notification] OK: ${order_id} -> paid, household ${payment.household_id}`);
    } else if (appliedStatus === 'failed') {
      console.log(`[payments notification] ${order_id} -> failed (${transaction_status})`);
    }
    // transaction_status 'pending' -> tidak diapa-apakan, tunggu notifikasi berikutnya

    res.json({ received: true });
  } catch (err) {
    console.error('[payments notification] Error:', err);
    res.status(500).json({ error: 'Gagal memproses webhook' });
  }
}

// GET /api/payments/notification — health/info endpoint untuk dicek dari browser.
// Midtrans tetap akan memakai POST ke URL yang sama.
router.get('/notification', async (_req, res) => {
  res.json({
    ok: true,
    endpoint: '/api/payments/notification',
    method: 'POST',
    purpose: 'Midtrans payment notification webhook',
  });
});

// POST /api/payments/notification — dipanggil server-to-server oleh Midtrans,
// TANPA authMiddleware. Signature WAJIB diverifikasi sebelum payload dipercaya.
router.post('/notification', handleMidtransNotification);

// Alias lama agar konfigurasi existing tetap jalan.
router.post('/webhook', handleMidtransNotification);

// POST /api/payments/xendit/notification — dipanggil server-to-server oleh Xendit,
// TANPA authMiddleware. Header x-callback-token WAJIB diverifikasi sebelum payload dipercaya.
router.post('/xendit/notification', async (req, res) => {
  try {
    if (!(await verifyXenditCallback(req))) {
      console.warn('[payments xendit notification] Callback token tidak valid, payload ditolak.');
      return res.status(403).json({ error: 'Invalid callback token' });
    }

    const { external_id: orderId, status } = req.body || {};
    if (!orderId) {
      return res.status(400).json({ error: 'external_id tidak ada' });
    }

    const paymentResult = await pool.query('SELECT * FROM payments WHERE order_id = $1', [orderId]);
    const payment = paymentResult.rows[0];
    if (!payment) {
      console.warn(`[payments xendit notification] order_id tidak dikenal: ${orderId}`);
      return res.status(404).json({ error: 'Order tidak ditemukan' });
    }

    // Idempotent: Xendit bisa mengirim notifikasi lebih dari sekali untuk order yang sama
    if (payment.status === 'paid') {
      return res.json({ received: true, alreadyProcessed: true });
    }

    const nextStatus = mapXenditStatus(status);
    const appliedStatus = await applyPaymentStatus(payment, nextStatus);

    if (appliedStatus === 'paid') {
      console.log(`[payments xendit notification] OK: ${orderId} -> paid, household ${payment.household_id}`);
    } else if (appliedStatus === 'failed') {
      console.log(`[payments xendit notification] ${orderId} -> failed (${status})`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[payments xendit notification] Error:', err);
    res.status(500).json({ error: 'Gagal memproses webhook Xendit' });
  }
});

export default router;
