import pool from '../db.js';
import { authMiddleware } from './auth.js';
import { resolveSubscriptionEntitlement } from '../services/planPolicy.js';

const EXACT_EXEMPT = new Set([
  '/api/health',
  '/api/households',
  '/api/households/onboarding-status',
]);
const PREFIX_EXEMPT = [
  '/api/auth',
  '/api/admin',
  '/api/payments',
  '/api/tracking',
  '/api/webhook',
];

export function isSubscriptionExemptPath(path = '') {
  if (EXACT_EXEMPT.has(path)) return true;
  if (PREFIX_EXEMPT.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return true;
  // Provider callbacks must remain reachable without a browser subscription session.
  if (path === '/api/telegram/webhook' || path === '/api/telegram/receipts') return true;
  if (path === '/api/whatsapp/webhook') return true;
  return false;
}

async function loadSubscription(userId) {
  const result = await pool.query(
    `SELECT s.plan, s.status, s.current_period_end
     FROM subscriptions s
     JOIN household_members hm ON hm.household_id = s.household_id
     WHERE hm.user_id = $1
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

export function subscriptionAccessMiddleware(req, res, next) {
  const fullPath = (req.originalUrl || req.path || '').split('?')[0];
  if (isSubscriptionExemptPath(fullPath)) return next();

  return authMiddleware(req, res, async () => {
    try {
      const subscription = await loadSubscription(req.user.userId);
      const entitlement = resolveSubscriptionEntitlement(subscription);
      if (!entitlement.access) {
        return res.status(402).json({
          error: 'Paket berlangganan aktif diperlukan. Pilih paket untuk melanjutkan.',
          code: 'PAYMENT_REQUIRED',
          paymentRequired: true,
        });
      }
      req.subscription = subscription;
      req.entitlement = entitlement;
      return next();
    } catch (err) {
      console.error('Subscription access check error:', err);
      return res.status(500).json({ error: 'Gagal memeriksa status langganan' });
    }
  });
}
