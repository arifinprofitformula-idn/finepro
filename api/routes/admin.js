import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import pool from '../db.js';
import { authMiddleware, adminMiddleware, superAdminMiddleware, adminRoleForEmail, generateToken } from '../middleware/auth.js';
import { auditAdminAction, getAllSettings, publicSetting, updateSetting } from '../services/appSettings.js';
import { getCurrentMetalPrices } from '../services/apeEpi.js';
import { PLANS, applyPaymentStatus } from './payments.js';

const router = Router();

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: 1,
  message: { error: 'Terlalu banyak percobaan, coba lagi beberapa menit lagi' },
});

const SETTING_KEYS = new Set(['mailketing', 'midtrans', 'manual_payment', 'ai', 'ai_quota', 'ape_epi', 'web_push', 'telegram']);

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

router.post('/login', adminLoginLimiter, async (req, res) => {
  try {
    const { password } = req.body || {};
    const email = normalizeEmail(req.body?.email);
    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan password wajib diisi' });
    }

    const result = await pool.query(
      'SELECT id, email, password_hash, name, avatar_url, role, created_at FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    const user = result.rows[0];
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Email atau password salah' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Email atau password salah' });
    }

    const role = adminRoleForEmail(user.email, user.role);
    if (!['admin', 'super_admin'].includes(role)) {
      return res.status(403).json({ error: 'Akses admin diperlukan' });
    }

    const token = generateToken(user);
    const { password_hash, ...safeUser } = user;
    res.json({ token, user: { ...safeUser, role, has_password: Boolean(password_hash) } });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Gagal login admin' });
  }
});

router.use(authMiddleware, adminMiddleware);

router.get('/me', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, avatar_url, role, created_at, (password_hash IS NOT NULL) AS has_password FROM users WHERE id = $1',
      [req.admin.id]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'Admin tidak ditemukan' });
    res.json({ user: { ...user, role: adminRoleForEmail(user.email, user.role) } });
  } catch (err) {
    console.error('Admin me error:', err);
    res.status(500).json({ error: 'Gagal mengambil data admin' });
  }
});

router.get('/overview', async (req, res) => {
  try {
    const [users, households, payments, transactions, subs] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS count FROM users'),
      pool.query('SELECT COUNT(*)::int AS count FROM households'),
      pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0)::numeric AS revenue,
           COUNT(*)::int AS count,
           COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_count,
           COUNT(*) FILTER (WHERE status = 'paid')::int AS paid_count
         FROM payments`
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count
         FROM transactions
         WHERE date >= date_trunc('month', CURRENT_DATE)`
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'active')::int AS active,
           COUNT(*) FILTER (WHERE status = 'expired')::int AS expired,
           COUNT(*) FILTER (WHERE plan = 'trial')::int AS trial
         FROM subscriptions`
      )
    ]);

    res.json({
      overview: {
        users: users.rows[0].count,
        households: households.rows[0].count,
        monthlyTransactions: transactions.rows[0].count,
        revenue: Number(payments.rows[0].revenue || 0),
        payments: {
          total: payments.rows[0].count,
          pending: payments.rows[0].pending_count,
          paid: payments.rows[0].paid_count,
        },
        subscriptions: subs.rows[0],
      }
    });
  } catch (err) {
    console.error('Admin overview error:', err);
    res.status(500).json({ error: 'Gagal mengambil ringkasan admin' });
  }
});

router.get('/settings', async (req, res) => {
  try {
    const settings = await getAllSettings();
    res.json({
      settings: Object.fromEntries(
        Object.entries(settings).map(([key, value]) => [key, publicSetting(key, value)])
      )
    });
  } catch (err) {
    console.error('Admin settings error:', err);
    res.status(500).json({ error: 'Gagal mengambil pengaturan integrasi' });
  }
});

router.patch('/settings/:key', async (req, res) => {
  try {
    const { key } = req.params;
    if (!SETTING_KEYS.has(key)) {
      return res.status(404).json({ error: 'Pengaturan tidak ditemukan' });
    }

    const next = await updateSetting(key, req.body || {}, req.admin.id);
    await auditAdminAction(req.admin.id, 'settings.update', 'app_settings', key, {
      fields: Object.keys(req.body || {}),
    });

    res.json({ setting: publicSetting(key, next) });
  } catch (err) {
    console.error('Update admin setting error:', err);
    res.status(500).json({ error: 'Gagal menyimpan pengaturan' });
  }
});

router.post('/ape-epi/test', async (req, res) => {
  try {
    const prices = await getCurrentMetalPrices({
      forceRefresh: true,
      bypassDailyLimit: true,
      settingsOverride: req.body || {},
    });
    await auditAdminAction(req.admin.id, 'integrations.ape_epi.test', 'app_settings', 'ape_epi', {
      enabled: prices.enabled,
      gold_date: prices.gold?.date || null,
      silver_date: prices.silver?.date || null,
    });
    res.json({ prices });
  } catch (err) {
    console.error('APE-EPI test error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Gagal menguji koneksi APE-EPI' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(toInt(req.query.limit, 50), 100);
    const offset = toInt(req.query.offset, 0);
    const params = [];
    let where = '';

    if (q) {
      params.push(`%${q}%`);
      where = `WHERE email ILIKE $${params.length} OR COALESCE(name, '') ILIKE $${params.length}`;
    }

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.created_at,
              h.id AS household_id, h.name AS household_name, hm.role AS household_role
       FROM users u
       LEFT JOIN household_members hm ON hm.user_id = u.id
       LEFT JOIN households h ON h.id = hm.household_id
       ${where}
       ORDER BY u.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      users: result.rows.map((u) => ({ ...u, effective_role: adminRoleForEmail(u.email, u.role) }))
    });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Gagal mengambil user' });
  }
});

router.patch('/users/:id/role', superAdminMiddleware, async (req, res) => {
  try {
    const role = req.body?.role;
    if (!['user', 'admin', 'super_admin'].includes(role)) {
      return res.status(400).json({ error: 'Role tidak valid' });
    }
    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, name, role, created_at',
      [role, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User tidak ditemukan' });

    await auditAdminAction(req.admin.id, 'users.role.update', 'users', req.params.id, { role });
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Update user role error:', err);
    res.status(500).json({ error: 'Gagal mengubah role user' });
  }
});

router.get('/households', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(toInt(req.query.limit, 20), 100);
    const offset = toInt(req.query.offset, 0);
    const params = [];
    let where = '';

    if (q) {
      params.push(`%${q}%`);
      where = `WHERE h.name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR COALESCE(u.name, '') ILIKE $${params.length}`;
    }

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT h.id, h.name, h.household_type, h.created_at,
              u.email AS owner_email, u.name AS owner_name,
              s.plan, s.status AS subscription_status, s.current_period_end,
              COUNT(DISTINCT hm.user_id)::int AS member_count,
              COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'paid'), 0)::numeric AS total_paid,
              COUNT(*) OVER()::int AS total_count
       FROM households h
       JOIN users u ON u.id = h.owner_id
       LEFT JOIN subscriptions s ON s.household_id = h.id
       LEFT JOIN household_members hm ON hm.household_id = h.id
       LEFT JOIN payments p ON p.household_id = h.id
       ${where}
       GROUP BY h.id, u.email, u.name, s.plan, s.status, s.current_period_end
       ORDER BY h.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const total = result.rows[0]?.total_count ?? 0;
    res.json({
      households: result.rows.map(({ total_count, ...row }) => row),
      total,
    });
  } catch (err) {
    console.error('Admin households error:', err);
    res.status(500).json({ error: 'Gagal mengambil household' });
  }
});

router.get('/households/:id', async (req, res) => {
  try {
    const householdResult = await pool.query(
      `SELECT h.id, h.name, h.household_type, h.created_at,
              u.email AS owner_email, u.name AS owner_name,
              s.plan, s.status AS subscription_status, s.current_period_end
       FROM households h
       JOIN users u ON u.id = h.owner_id
       LEFT JOIN subscriptions s ON s.household_id = h.id
       WHERE h.id = $1`,
      [req.params.id]
    );
    const household = householdResult.rows[0];
    if (!household) return res.status(404).json({ error: 'Household tidak ditemukan' });

    const [members, payments] = await Promise.all([
      pool.query(
        `SELECT u.id, u.name, u.email, hm.role
         FROM household_members hm
         JOIN users u ON u.id = hm.user_id
         WHERE hm.household_id = $1
         ORDER BY hm.joined_at ASC`,
        [req.params.id]
      ),
      pool.query(
        `SELECT order_id, plan, amount, status, created_at, paid_at
         FROM payments
         WHERE household_id = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [req.params.id]
      )
    ]);

    res.json({ household, members: members.rows, payments: payments.rows });
  } catch (err) {
    console.error('Admin household detail error:', err);
    res.status(500).json({ error: 'Gagal mengambil detail household' });
  }
});

router.post('/households/:id/manual-payment', async (req, res) => {
  try {
    const plan = req.body?.plan;
    const planConfig = PLANS[plan];
    if (!planConfig) {
      return res.status(400).json({ error: 'Plan tidak valid' });
    }

    const householdResult = await pool.query('SELECT id FROM households WHERE id = $1', [req.params.id]);
    if (!householdResult.rows[0]) {
      return res.status(404).json({ error: 'Household tidak ditemukan' });
    }

    const orderId = `MANUAL-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    await pool.query(
      `INSERT INTO payments (household_id, order_id, plan, amount, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [req.params.id, orderId, plan, planConfig.amount]
    );

    const status = await applyPaymentStatus(
      { order_id: orderId, plan, household_id: req.params.id, status: 'pending' },
      'paid'
    );

    await auditAdminAction(req.admin.id, 'payments.manual.record', 'payments', orderId, {
      household_id: req.params.id,
      plan,
      amount: planConfig.amount,
    });

    res.status(201).json({ payment: { order_id: orderId, plan, amount: planConfig.amount, status } });
  } catch (err) {
    console.error('Record manual payment error:', err);
    res.status(500).json({ error: 'Gagal mencatat pembayaran manual' });
  }
});

router.get('/payments', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || '').trim();
    const limit = Math.min(toInt(req.query.limit, 20), 100);
    const offset = toInt(req.query.offset, 0);
    const conditions = [];
    const params = [];

    if (q) {
      params.push(`%${q}%`);
      conditions.push(`(h.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }
    if (['pending', 'paid', 'failed'].includes(status)) {
      params.push(status);
      conditions.push(`p.status = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT p.order_id, p.plan, p.amount, p.status, p.created_at, p.paid_at,
              h.name AS household_name, u.email AS owner_email,
              COUNT(*) OVER()::int AS total_count
       FROM payments p
       JOIN households h ON h.id = p.household_id
       JOIN users u ON u.id = h.owner_id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const total = result.rows[0]?.total_count ?? 0;
    res.json({
      payments: result.rows.map(({ total_count, ...row }) => row),
      total,
    });
  } catch (err) {
    console.error('Admin payments error:', err);
    res.status(500).json({ error: 'Gagal mengambil pembayaran' });
  }
});

router.get('/audit-logs', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.id, l.action, l.target_type, l.target_id, l.metadata, l.created_at,
              u.email AS admin_email, u.name AS admin_name
       FROM admin_audit_logs l
       JOIN users u ON u.id = l.admin_user_id
       ORDER BY l.created_at DESC
       LIMIT 100`
    );
    res.json({ logs: result.rows });
  } catch (err) {
    console.error('Admin audit logs error:', err);
    res.status(500).json({ error: 'Gagal mengambil audit log' });
  }
});

export default router;
