import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import pool from '../db.js';
import { authMiddleware, adminMiddleware, superAdminMiddleware, adminRoleForEmail, generateToken } from '../middleware/auth.js';
import { auditAdminAction, getAllSettings, publicSetting, updateSetting } from '../services/appSettings.js';
import { getCurrentMetalPrices, getCachedMetalPricesStatus } from '../services/apeEpi.js';
import { getMailketingLists, sendMail } from '../services/mailer.js';
import { PLANS, applyPaymentStatus } from './payments.js';

const router = Router();
const isLocalDev = process.env.LOCAL_DEV === 'true';

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skip: () => isLocalDev,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan, coba lagi beberapa menit lagi' },
});

const SETTING_KEYS = new Set(['mailketing', 'midtrans', 'xendit', 'payment_gateway', 'manual_payment', 'ai', 'ai_quota', 'ape_epi', 'web_push', 'telegram', 'whatsapp']);

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseMonth(value) {
  const raw = String(value || '').trim();
  const fallback = new Date().toISOString().slice(0, 7);
  let month = /^\d{4}-\d{2}$/.test(raw) ? raw : fallback;
  const [year, monthNum] = month.split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
    month = fallback;
  }
  const [safeYear, safeMonthNum] = month.split('-').map(Number);
  const start = new Date(Date.UTC(safeYear, safeMonthNum - 1, 1));
  const end = new Date(Date.UTC(safeYear, safeMonthNum, 1));
  return {
    month,
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function monthLabelFromKey(month) {
  const [year, monthNum] = String(month).split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(new Date(year, monthNum - 1, 1));
}

async function ensureBusinessExpensesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS business_expenses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      label TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Operasional',
      amount NUMERIC NOT NULL CHECK (amount >= 0),
      expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
      note TEXT,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_business_expenses_date ON business_expenses(expense_date DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_business_expenses_category ON business_expenses(category)');
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

router.get('/ape-epi/status', async (req, res) => {
  try {
    const status = await getCachedMetalPricesStatus();
    res.json({ status });
  } catch (err) {
    console.error('APE-EPI status error:', err);
    res.status(500).json({ error: 'Gagal mengambil status sinkronisasi APE-EPI' });
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

router.post('/mailketing/test', async (req, res) => {
  try {
    const to = normalizeEmail(req.body?.to || req.admin.email);
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) {
      return res.status(400).json({ error: 'Email tujuan test tidak valid' });
    }

    const safeEmail = escapeHtml(to);
    await sendMail({
      to,
      subject: 'Test Email FinePro - Mailketing Aktif',
      html: `
<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Test Email FinePro</title>
  </head>
  <body style="margin:0;background:#f6fbff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1c2230;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6fbff;padding:28px 14px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #dfe8f1;border-radius:24px;overflow:hidden;box-shadow:0 20px 55px rgba(49,77,119,0.14);">
            <tr>
              <td style="padding:26px 24px;background:linear-gradient(135deg,#0f1f3d 0%,#6f55f2 100%);">
                <img src="https://finepro.my.id/images/fine-pro-header.png" alt="FinePro" width="240" style="display:block;max-width:240px;width:100%;height:auto;margin:0 0 18px 0;" />
                <h1 style="margin:18px 0 0;color:#ffffff;font-size:24px;line-height:1.25;">Mailketing FinePro aktif</h1>
                <p style="margin:8px 0 0;color:rgba(255,255,255,0.82);font-size:14px;line-height:1.6;">Email percobaan dari Admin Console berhasil dikirim.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 24px;">
                <p style="margin:0 0 14px;font-size:15px;line-height:1.7;">Halo,</p>
                <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#3f4657;">Ini adalah email test untuk memastikan integrasi Mailketing FinePro sudah berjalan baik.</p>
                <div style="background:#efeaff;border:1px solid rgba(111,85,242,0.18);border-radius:16px;padding:14px 16px;margin:0 0 18px;">
                  <p style="margin:0;font-size:13px;line-height:1.65;color:#3f2ca8;">Tujuan test:</p>
                  <p style="margin:8px 0 0;font-size:14px;font-weight:800;word-break:break-all;color:#0f1f3d;">${safeEmail}</p>
                </div>
                <p style="margin:0;font-size:13px;line-height:1.7;color:#6b7280;">Jika email ini diterima, fitur reset password, undangan anggota, dan email transaksional lain siap digunakan.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
    });

    await auditAdminAction(req.admin.id, 'integrations.mailketing.test', 'app_settings', 'mailketing', { to });
    res.json({ sent: true, to });
  } catch (err) {
    console.error('Mailketing test error:', err);
    res.status(500).json({ error: err.message || 'Gagal mengirim test email Mailketing' });
  }
});

router.post('/mailketing/lists', async (req, res) => {
  try {
    const lists = await getMailketingLists(req.body || {});
    await auditAdminAction(req.admin.id, 'integrations.mailketing.viewlist', 'app_settings', 'mailketing', {
      count: lists.length,
    });
    res.json({ lists });
  } catch (err) {
    console.error('Mailketing list error:', err);
    res.status(500).json({ error: err.message || 'Gagal mengambil daftar list Mailketing' });
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
      where = `WHERE h.name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR COALESCE(u.name, '') ILIKE $${params.length}
        OR EXISTS (
          SELECT 1 FROM household_members hm2
          JOIN users u2 ON u2.id = hm2.user_id
          WHERE hm2.household_id = h.id AND (u2.email ILIKE $${params.length} OR COALESCE(u2.name, '') ILIKE $${params.length})
        )`;
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
        `SELECT u.id, u.name, u.email, u.role AS system_role, hm.role AS household_role
         FROM household_members hm
         JOIN users u ON u.id = hm.user_id
         WHERE hm.household_id = $1
         ORDER BY hm.joined_at ASC`,
        [req.params.id]
      ),
      pool.query(
        `SELECT order_id, plan, amount, status, method, proof_url, reference, created_at, paid_at
         FROM payments
         WHERE household_id = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [req.params.id]
      )
    ]);

    const membersWithEffectiveRole = members.rows.map((m) => ({
      ...m,
      effective_role: adminRoleForEmail(m.email, m.system_role),
    }));

    res.json({ household, members: membersWithEffectiveRole, payments: payments.rows });
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
      `INSERT INTO payments (household_id, order_id, plan, amount, status, method)
       VALUES ($1, $2, $3, $4, 'pending', 'manual')`,
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
    const method = String(req.query.method || '').trim();
    const limit = Math.min(toInt(req.query.limit, 20), 100);
    const offset = toInt(req.query.offset, 0);
    const conditions = [];
    const params = [];

    if (q) {
      params.push(`%${q}%`);
      conditions.push(`(h.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }
    if (['pending', 'paid', 'failed', 'rejected'].includes(status)) {
      params.push(status);
      conditions.push(`p.status = $${params.length}`);
    }
    if (['midtrans', 'xendit', 'manual'].includes(method)) {
      params.push(method);
      conditions.push(`p.method = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT p.order_id, p.plan, p.amount, p.status, p.method, p.proof_url, p.reference, p.note,
              p.created_at, p.paid_at, p.reviewed_at,
              h.id AS household_id, h.name AS household_name, u.email AS owner_email,
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

router.get('/finance', async (req, res) => {
  try {
    await ensureBusinessExpensesTable();
    const { month, start, end } = parseMonth(req.query.month);
    const current = new Date(`${month}-01T00:00:00Z`);
    const trendMonths = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - (5 - i), 1));
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    });
    const trendStart = `${trendMonths[0]}-01`;

    const [summary, expenses, byPlan, byMethod, revenueTrend, expenseTrend, activePaid] = await Promise.all([
      pool.query(
        `SELECT
           COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0)::numeric AS revenue,
           COUNT(*) FILTER (WHERE status = 'paid')::int AS paid_count,
           COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_count,
           COUNT(*) FILTER (WHERE status IN ('failed', 'rejected'))::int AS failed_count,
           COUNT(DISTINCT household_id) FILTER (WHERE status = 'paid')::int AS paid_households
         FROM payments
         WHERE COALESCE(paid_at, created_at) >= $1::date
           AND COALESCE(paid_at, created_at) < $2::date`,
        [start, end]
      ),
      pool.query(
        `SELECT id, label, category, amount, expense_date, note, created_at
         FROM business_expenses
         WHERE expense_date >= $1::date AND expense_date < $2::date
         ORDER BY expense_date DESC, created_at DESC`,
        [start, end]
      ),
      pool.query(
        `SELECT plan, COALESCE(SUM(amount), 0)::numeric AS total, COUNT(*)::int AS count
         FROM payments
         WHERE status = 'paid'
           AND COALESCE(paid_at, created_at) >= $1::date
           AND COALESCE(paid_at, created_at) < $2::date
         GROUP BY plan
         ORDER BY total DESC`,
        [start, end]
      ),
      pool.query(
        `SELECT method, COALESCE(SUM(amount), 0)::numeric AS total, COUNT(*)::int AS count
         FROM payments
         WHERE status = 'paid'
           AND COALESCE(paid_at, created_at) >= $1::date
           AND COALESCE(paid_at, created_at) < $2::date
         GROUP BY method
         ORDER BY total DESC`,
        [start, end]
      ),
      pool.query(
        `SELECT to_char(date_trunc('month', COALESCE(paid_at, created_at)), 'YYYY-MM') AS month,
                COALESCE(SUM(amount), 0)::numeric AS total
         FROM payments
         WHERE status = 'paid'
           AND COALESCE(paid_at, created_at) >= $1::date
           AND COALESCE(paid_at, created_at) < $2::date
         GROUP BY 1`,
        [trendStart, end]
      ),
      pool.query(
        `SELECT to_char(date_trunc('month', expense_date), 'YYYY-MM') AS month,
                COALESCE(SUM(amount), 0)::numeric AS total
         FROM business_expenses
         WHERE expense_date >= $1::date AND expense_date < $2::date
         GROUP BY 1`,
        [trendStart, end]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count
         FROM subscriptions
         WHERE status = 'active' AND plan <> 'trial'`
      ),
    ]);

    const expenseTotal = expenses.rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const revenue = Number(summary.rows[0]?.revenue || 0);
    const profit = revenue - expenseTotal;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const revenueByMonth = new Map(revenueTrend.rows.map((row) => [row.month, Number(row.total || 0)]));
    const expenseByMonth = new Map(expenseTrend.rows.map((row) => [row.month, Number(row.total || 0)]));

    res.json({
      report: {
        month,
        label: monthLabelFromKey(month),
        summary: {
          revenue,
          expense: expenseTotal,
          profit,
          margin,
          paid_count: summary.rows[0]?.paid_count || 0,
          pending_count: summary.rows[0]?.pending_count || 0,
          failed_count: summary.rows[0]?.failed_count || 0,
          paid_households: summary.rows[0]?.paid_households || 0,
          active_paid_users: activePaid.rows[0]?.count || 0,
        },
        by_plan: byPlan.rows.map((row) => ({ ...row, total: Number(row.total || 0) })),
        by_method: byMethod.rows.map((row) => ({ ...row, total: Number(row.total || 0) })),
        trend: trendMonths.map((m) => {
          const rev = revenueByMonth.get(m) || 0;
          const exp = expenseByMonth.get(m) || 0;
          return { month: m, label: monthLabelFromKey(m), revenue: rev, expense: exp, profit: rev - exp };
        }),
        expenses: expenses.rows.map((row) => ({ ...row, amount: Number(row.amount || 0) })),
      },
    });
  } catch (err) {
    console.error('Admin finance report error:', err);
    res.status(500).json({ error: 'Gagal mengambil laporan keuangan' });
  }
});

router.post('/finance/expenses', async (req, res) => {
  try {
    await ensureBusinessExpensesTable();
    const label = String(req.body?.label || '').trim();
    const category = String(req.body?.category || 'Operasional').trim() || 'Operasional';
    const amount = Number(req.body?.amount || 0);
    const expenseDate = String(req.body?.expense_date || '').trim();
    const note = String(req.body?.note || '').trim();

    if (!label) return res.status(400).json({ error: 'Nama biaya wajib diisi' });
    if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: 'Nominal biaya tidak valid' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) return res.status(400).json({ error: 'Tanggal biaya tidak valid' });

    const result = await pool.query(
      `INSERT INTO business_expenses (label, category, amount, expense_date, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, label, category, amount, expense_date, note, created_at`,
      [label, category, amount, expenseDate, note || null, req.admin.id]
    );

    await auditAdminAction(req.admin.id, 'finance.expense.create', 'business_expenses', result.rows[0].id, {
      label,
      category,
      amount,
      expense_date: expenseDate,
    });
    res.status(201).json({ expense: { ...result.rows[0], amount: Number(result.rows[0].amount || 0) } });
  } catch (err) {
    console.error('Create business expense error:', err);
    res.status(500).json({ error: 'Gagal menyimpan biaya operasional' });
  }
});

router.delete('/finance/expenses/:id', async (req, res) => {
  try {
    await ensureBusinessExpensesTable();
    const result = await pool.query(
      'DELETE FROM business_expenses WHERE id = $1 RETURNING id, label, amount',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Biaya tidak ditemukan' });
    await auditAdminAction(req.admin.id, 'finance.expense.delete', 'business_expenses', req.params.id, result.rows[0]);
    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete business expense error:', err);
    res.status(500).json({ error: 'Gagal menghapus biaya operasional' });
  }
});

router.patch('/payments/:orderId/review', async (req, res) => {
  try {
    const { action, note } = req.body || {};
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Aksi tidak valid' });
    }

    const paymentResult = await pool.query('SELECT * FROM payments WHERE order_id = $1', [req.params.orderId]);
    const payment = paymentResult.rows[0];
    if (!payment) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    }
    if (payment.status !== 'pending') {
      return res.status(400).json({ error: 'Transaksi ini sudah direview' });
    }

    if (action === 'approve') {
      await applyPaymentStatus(payment, 'paid');
      await pool.query(
        `UPDATE payments SET note = $1, reviewed_by = $2, reviewed_at = now() WHERE order_id = $3`,
        [note || null, req.admin.id, req.params.orderId]
      );
    } else {
      await pool.query(
        `UPDATE payments SET status = 'rejected', note = $1, reviewed_by = $2, reviewed_at = now() WHERE order_id = $3`,
        [note || null, req.admin.id, req.params.orderId]
      );
    }

    await auditAdminAction(req.admin.id, `payments.manual.${action}`, 'payments', req.params.orderId, { note });

    const updated = await pool.query('SELECT * FROM payments WHERE order_id = $1', [req.params.orderId]);
    res.json({ payment: updated.rows[0] });
  } catch (err) {
    console.error('Review manual payment error:', err);
    res.status(500).json({ error: 'Gagal mereview pembayaran' });
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
