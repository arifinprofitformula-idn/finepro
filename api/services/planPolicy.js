export const SELLABLE_PLANS = new Set(['monthly', 'quarterly', 'annual', 'lifetime']);

export const RECURRING_PAID_PLANS = new Set(['monthly', 'quarterly', 'semiannual', 'annual']);

export const PLAN_MONTHS = Object.freeze({
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
});

export const DEFAULT_PLAN_PRICES = Object.freeze({
  monthly: 35000,
  quarterly: 79000,
  annual: 249000,
  lifetime: 649000,
});

export const FAIR_USE_LIMITS = Object.freeze({
  receipt_scan: Object.freeze({ scope: 'day', limit: 200 }),
  ai_insight: Object.freeze({ scope: 'day', limit: 30 }),
  telegram_chat: Object.freeze({ scope: 'day', limit: 500 }),
  whatsapp_chat: Object.freeze({ scope: 'day', limit: 500 }),
});

export function recurringFairUseLimit(plan, feature) {
  if (!RECURRING_PAID_PLANS.has(plan)) return null;
  const policy = FAIR_USE_LIMITS[feature];
  return policy ? { ...policy } : null;
}

export function resolveSubscriptionEntitlement(subscription, now = new Date()) {
  if (!subscription || subscription.status !== 'active') {
    return { access: false, mode: 'payment_required' };
  }

  if (subscription.plan === 'lifetime') {
    return { access: true, mode: 'finite_credit' };
  }

  if (RECURRING_PAID_PLANS.has(subscription.plan)) {
    return { access: true, mode: 'unlimited_fair_use' };
  }

  if (subscription.plan === 'trial') {
    const rawEnd = subscription.current_period_end;
    const end = rawEnd
      ? new Date(typeof rawEnd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawEnd)
        ? `${rawEnd}T23:59:59.999Z`
        : rawEnd)
      : null;
    if (end && !Number.isNaN(end.getTime()) && end >= now) {
      return { access: true, mode: 'legacy_trial' };
    }
  }

  return { access: false, mode: 'payment_required' };
}
