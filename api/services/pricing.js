// api/services/pricing.js
// Harga paket + status promo Early Access — dihitung live dari
// app_settings.pricing + jumlah pembelian promo yang sudah 'paid',
// supaya harga otomatis kembali normal tanpa perlu deploy manual.

import pool from '../db.js';
import { getSetting } from './appSettings.js';

export const PLAN_LABELS = {
  monthly: 'Bulanan',
  quarterly: '3 Bulan',
  semiannual: '6 Bulan',
  annual: 'Tahunan',
  lifetime: 'Lifetime',
};

export const PLAN_MONTHS = {
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

const PROMO_ELIGIBLE_PLANS = new Set(['annual', 'lifetime']);

async function countPromoRedemptions(plan) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM payments WHERE plan = $1 AND is_promo = true AND status = 'paid'`,
    [plan]
  );
  return Number(result.rows[0]?.count || 0);
}

async function isPromoActive(plan, pricing) {
  if (!PROMO_ELIGIBLE_PLANS.has(plan)) return false;
  if (!pricing.promo_start_date) return false;

  const start = new Date(pricing.promo_start_date);
  if (Number.isNaN(start.getTime())) return false;

  const deadline = new Date(start.getTime() + Number(pricing.promo_days || 30) * 24 * 60 * 60 * 1000);
  if (new Date() > deadline) return false;

  const maxUsers = Number(pricing.promo_max_users?.[plan] || 0);
  if (maxUsers <= 0) return false;

  const redeemed = await countPromoRedemptions(plan);
  return redeemed < maxUsers;
}

// { amount, months, label, isPromo } — plan lifetime punya months=null (tanpa expiry)
export async function getPlanPricing(plan) {
  if (plan === 'lifetime') {
    const pricing = await getSetting('pricing');
    const promoActive = await isPromoActive('lifetime', pricing);
    return {
      amount: promoActive ? pricing.promo.lifetime : pricing.normal.lifetime,
      months: null,
      label: PLAN_LABELS.lifetime,
      isPromo: promoActive,
    };
  }

  const months = PLAN_MONTHS[plan];
  if (!months) return null;

  const pricing = await getSetting('pricing');
  const promoActive = plan === 'annual' ? await isPromoActive('annual', pricing) : false;
  const normalAmount = plan === 'semiannual'
    ? pricing.normal.quarterly // legacy plan, tidak dijual lagi — pakai referensi harga quarterly kalau perlu dihitung ulang
    : pricing.normal[plan];

  return {
    amount: promoActive ? pricing.promo.annual : normalAmount,
    months,
    label: PLAN_LABELS[plan] || plan,
    isPromo: promoActive,
  };
}

export async function getAllPlanPricing() {
  const plans = ['quarterly', 'annual', 'lifetime'];
  const entries = await Promise.all(plans.map(async (plan) => [plan, await getPlanPricing(plan)]));
  return Object.fromEntries(entries);
}

// Harga top-up kredit AI Lifetime — tetap, tidak terpengaruh promo Lifetime.
export async function getTopupPricing() {
  const aiCredit = await getSetting('ai_credit');
  return { amount: aiCredit.topup_price, label: 'Top-Up Kredit AI' };
}
