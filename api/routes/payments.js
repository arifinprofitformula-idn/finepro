import { Router } from 'express';
import crypto from 'crypto';
import midtransClient from 'midtrans-client';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { getSetting } from '../services/appSettings.js';

const router = Router();

const PLANS = {
  monthly: { amount: 29000, months: 1, label: 'Bulanan' },
  semiannual: { amount: 149000, months: 6, label: '6 Bulan' },
  annual: { amount: 249000, months: 12, label: 'Tahunan' },
};

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
async function getMidtransSnap() {
  const config = await getSetting('midtrans');
  if (!config.enabled || !config.server_key || !config.client_key) {
    throw new Error('Midtrans belum dikonfigurasi');
  }
  return new midtransClient.Snap({
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

// POST /api/payments/create — buat transaksi Midtrans Snap untuk upgrade plan
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { plan } = req.body;
    const planConfig = PLANS[plan];
    if (!planConfig) {
      return res.status(400).json({ error: 'Plan tidak valid' });
    }

    const householdId = await getOwnerHouseholdId(req.user.userId);
    if (!householdId) {
      return res.status(403).json({ error: 'Hanya pemilik household yang bisa mengubah langganan' });
    }
    const snap = await getMidtransSnap();

    const userResult = await pool.query('SELECT name, email FROM users WHERE id = $1', [req.user.userId]);
    const user = userResult.rows[0];

    const orderId = `SUB-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    await pool.query(
      `INSERT INTO payments (household_id, order_id, plan, amount, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
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
        finish: `${process.env.APP_BASE_URL}/?order_id=${orderId}`,
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

// GET /api/payments/status/:orderId — dipoll frontend setelah redirect balik dari Midtrans
router.get('/status/:orderId', authMiddleware, async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    const result = await pool.query(
      'SELECT order_id, plan, amount, status, created_at, paid_at FROM payments WHERE order_id = $1 AND household_id = $2',
      [req.params.orderId, householdId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    }
    res.json({ payment: result.rows[0] });
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
      `SELECT order_id, plan, amount, status, created_at, paid_at
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
    const [midtrans, manual] = await Promise.all([
      getSetting('midtrans'),
      getSetting('manual_payment'),
    ]);
    res.json({
      methods: {
        midtrans: { enabled: Boolean(midtrans.enabled && midtrans.server_key && midtrans.client_key) },
        manual: {
          enabled: Boolean(manual.enabled),
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

// POST /api/payments/webhook — dipanggil server-to-server oleh Midtrans, TANPA authMiddleware
// (Midtrans tidak mengirim Bearer token kita). Signature WAJIB diverifikasi
// sebelum payload dipercaya — jangan proses apa pun kalau gagal.
router.post('/webhook', async (req, res) => {
  try {
    if (!(await verifyMidtransSignature(req.body))) {
      console.warn('[payments webhook] Signature tidak valid, payload ditolak.');
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

    const isPaid = transaction_status === 'settlement' ||
      (transaction_status === 'capture' && fraud_status === 'accept');
    const isFailed = ['deny', 'cancel', 'expire', 'failure'].includes(transaction_status);

    if (isPaid) {
      const planConfig = PLANS[payment.plan];
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE payments SET status = 'paid', paid_at = now() WHERE order_id = $1`,
          [order_id]
        );
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
      console.log(`[payments webhook] OK: ${order_id} -> paid, household ${payment.household_id}`);
    } else if (isFailed) {
      await pool.query(`UPDATE payments SET status = 'failed' WHERE order_id = $1`, [order_id]);
      console.log(`[payments webhook] ${order_id} -> failed (${transaction_status})`);
    }
    // transaction_status 'pending' -> tidak diapa-apakan, tunggu notifikasi berikutnya

    res.json({ received: true });
  } catch (err) {
    console.error('[payments webhook] Error:', err);
    res.status(500).json({ error: 'Gagal memproses webhook' });
  }
});

export default router;
