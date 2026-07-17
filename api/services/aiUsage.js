import pool from '../db.js';
import { getSetting } from './appSettings.js';
import { assertCreditAvailable, debitCredit, getCreditQuotaStatus } from './aiCredits.js';

const SHORT_PLANS = new Set(['monthly', 'quarterly', 'semiannual']);

function toNonNegativeInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

async function getSubscription(householdId) {
  const result = await pool.query(
    `SELECT plan, status, current_period_end
     FROM subscriptions
     WHERE household_id = $1
     LIMIT 1`,
    [householdId]
  );
  return result.rows[0] || null;
}

// group: 'lifetime' | 'annual' | 'short' | 'trial' | 'free' — dipakai buat pilih
// kelompok kuota (short_*/annual_*) atau sistem kredit lifetime.
export async function resolveUsageTier(householdId) {
  const subscription = await getSubscription(householdId);
  const plan = subscription?.plan || 'free';
  const active = subscription?.status === 'active';

  if (active && plan === 'lifetime') return { tier: 'lifetime', family: 'lifetime', group: 'lifetime', subscription };
  if (active && plan === 'annual') return { tier: 'annual', family: 'paid', group: 'annual', subscription };
  if (active && SHORT_PLANS.has(plan)) return { tier: plan, family: 'paid', group: 'short', subscription };
  if (active && plan === 'trial') return { tier: 'trial', family: 'trial', group: 'trial', subscription };
  return { tier: 'free', family: 'free', group: 'free', subscription };
}

export async function getAiQuotaConfig() {
  const quota = await getSetting('ai_quota');
  return {
    trial_insight_total: toNonNegativeInt(quota.trial_insight_total, 3),
    trial_scan_total: toNonNegativeInt(quota.trial_scan_total, 5),
    free_insight_monthly: toNonNegativeInt(quota.free_insight_monthly, 1),
    free_scan_monthly: toNonNegativeInt(quota.free_scan_monthly, 3),
    short_scan_monthly: toNonNegativeInt(quota.short_scan_monthly, 20),
    short_insight_daily: toNonNegativeInt(quota.short_insight_daily, 2),
    short_telegram_daily: toNonNegativeInt(quota.short_telegram_daily, 30),
    short_whatsapp_daily: toNonNegativeInt(quota.short_whatsapp_daily, 20),
    annual_scan_monthly: toNonNegativeInt(quota.annual_scan_monthly, 40),
    annual_insight_daily: toNonNegativeInt(quota.annual_insight_daily, 3),
    annual_telegram_daily: toNonNegativeInt(quota.annual_telegram_daily, 50),
    annual_whatsapp_daily: toNonNegativeInt(quota.annual_whatsapp_daily, 30),
  };
}

function chatDailyLimitFor(feature, group, quota) {
  if (group === 'annual') {
    if (feature === 'telegram_chat') return quota.annual_telegram_daily;
    if (feature === 'whatsapp_chat') return quota.annual_whatsapp_daily;
  }
  if (group === 'short') {
    if (feature === 'telegram_chat') return quota.short_telegram_daily;
    if (feature === 'whatsapp_chat') return quota.short_whatsapp_daily;
  }
  return 0;
}

function scopeFor(feature, group) {
  if (group === 'annual' && feature === 'ai_insight') return 'day';
  if (group === 'short' && feature === 'ai_insight') return 'day';
  if (group === 'trial') return 'total';
  return 'month';
}

function limitFor(feature, group, quota) {
  if (feature === 'receipt_scan') {
    if (group === 'annual') return quota.annual_scan_monthly;
    if (group === 'short') return quota.short_scan_monthly;
    if (group === 'trial') return quota.trial_scan_total;
    return quota.free_scan_monthly;
  }

  if (group === 'annual') return quota.annual_insight_daily;
  if (group === 'short') return quota.short_insight_daily;
  if (group === 'trial') return quota.trial_insight_total;
  return quota.free_insight_monthly;
}

async function countUsage(householdId, feature, scope) {
  const params = [householdId, feature];
  let where = 'household_id = $1 AND feature = $2';

  if (scope === 'day') {
    where += ' AND created_at >= CURRENT_DATE';
  } else if (scope === 'month') {
    where += ` AND created_at >= date_trunc('month', now())`;
  }

  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM ai_usage_events WHERE ${where}`,
    params
  );
  return Number(result.rows[0]?.count || 0);
}

async function countUserUsage(userId, feature, scope) {
  const params = [userId, feature];
  let where = 'user_id = $1 AND feature = $2';

  if (scope === 'day') {
    where += ' AND created_at >= CURRENT_DATE';
  } else if (scope === 'month') {
    where += ` AND created_at >= date_trunc('month', now())`;
  }

  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM ai_usage_events WHERE ${where}`,
    params
  );
  return Number(result.rows[0]?.count || 0);
}

export async function getQuotaStatus(householdId, feature) {
  const { group, tier } = await resolveUsageTier(householdId);

  if (group === 'lifetime') {
    return getCreditQuotaStatus(householdId, feature);
  }

  const quota = await getAiQuotaConfig();
  const scope = scopeFor(feature, group);
  const limit = limitFor(feature, group, quota);
  const used = await countUsage(householdId, feature, scope);

  return {
    feature,
    tier,
    family: group,
    scope,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    allowed: used < limit,
  };
}

export async function assertQuotaAvailable(householdId, feature, label) {
  const { group } = await resolveUsageTier(householdId);

  if (group === 'lifetime') {
    return assertCreditAvailable(householdId, feature, label);
  }

  const status = await getQuotaStatus(householdId, feature);
  if (!status.allowed) {
    const scopeLabel = status.scope === 'day' ? 'hari ini' : status.scope === 'month' ? 'bulan ini' : 'selama masa trial';
    const error = new Error(`${label} ${scopeLabel} sudah habis (${status.used}/${status.limit}). Upgrade paket untuk melanjutkan.`);
    error.status = 429;
    error.quota = status;
    throw error;
  }
  return status;
}

export async function getUserDailyQuotaStatus(userId, feature) {
  // reserveUserDailyAiUsage butuh householdId utk cek group lifetime; endpoint status
  // ringan ini dipakai lewat feature/userId saja, jadi kelompok 'short' dipakai sbg default
  // aman (limit terkecil) kalau dipanggil tanpa konteks household.
  const quota = await getAiQuotaConfig();
  const limit = chatDailyLimitFor(feature, 'short', quota);
  const used = await countUserUsage(userId, feature, 'day');

  return {
    feature,
    scope: 'day',
    limit,
    used,
    remaining: Math.max(0, limit - used),
    allowed: used < limit,
  };
}

export async function assertUserDailyQuotaAvailable(userId, feature, label) {
  const status = await getUserDailyQuotaStatus(userId, feature);
  if (!status.allowed) {
    const error = new Error(`${label} hari ini sudah habis (${status.used}/${status.limit}). Coba lagi besok.`);
    error.status = 429;
    error.quota = status;
    throw error;
  }
  return status;
}

export async function reserveUserDailyAiUsage({
  householdId,
  userId,
  feature,
  source = 'telegram',
  usedAi = true,
  provider = null,
  model = null,
  metadata = {},
  label = 'Kuota AI',
}) {
  const { group } = await resolveUsageTier(householdId);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `ai_usage:${feature}:${userId}:${new Date().toISOString().slice(0, 10)}`,
    ]);

    if (group === 'lifetime') {
      const { balance } = await client.query(
        `SELECT balance FROM ai_credits WHERE household_id = $1 AND feature = $2`,
        [householdId, feature]
      ).then((r) => r.rows[0] || { balance: 0 });

      if (balance < 1) {
        await client.query('ROLLBACK');
        const error = new Error(`${label} kredit AI Anda sudah habis. Silakan lakukan Top-Up Kredit AI untuk melanjutkan.`);
        error.status = 429;
        error.creditExhausted = true;
        throw error;
      }

      const insertResult = await client.query(
        `INSERT INTO ai_usage_events
          (household_id, user_id, feature, source, used_ai, provider, model, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id`,
        [
          householdId,
          userId,
          feature,
          source,
          Boolean(usedAi),
          provider,
          model,
          JSON.stringify(metadata || {}),
        ]
      );

      const newBalance = await debitCredit(client, householdId, feature, insertResult.rows[0]?.id);

      await client.query('COMMIT');
      return {
        id: insertResult.rows[0]?.id,
        feature,
        scope: 'credit',
        limit: null,
        used: null,
        remaining: newBalance,
        allowed: true,
      };
    }

    const quota = await getAiQuotaConfig();
    const limit = chatDailyLimitFor(feature, group, quota);

    const usageResult = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM ai_usage_events
       WHERE user_id = $1 AND feature = $2 AND created_at >= CURRENT_DATE`,
      [userId, feature]
    );
    const used = Number(usageResult.rows[0]?.count || 0);

    if (used >= limit) {
      await client.query('ROLLBACK');
      const error = new Error(`${label} hari ini sudah habis (${used}/${limit}). Coba lagi besok.`);
      error.status = 429;
      error.quota = {
        feature,
        scope: 'day',
        limit,
        used,
        remaining: 0,
        allowed: false,
      };
      throw error;
    }

    const insertResult = await client.query(
      `INSERT INTO ai_usage_events
        (household_id, user_id, feature, source, used_ai, provider, model, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [
        householdId,
        userId,
        feature,
        source,
        Boolean(usedAi),
        provider,
        model,
        JSON.stringify(metadata || {}),
      ]
    );

    await client.query('COMMIT');
    return {
      id: insertResult.rows[0]?.id,
      feature,
      scope: 'day',
      limit,
      used: used + 1,
      remaining: Math.max(0, limit - used - 1),
      allowed: true,
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // transaction may already be closed
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function recordAiUsage({
  householdId,
  userId = null,
  feature,
  source = 'web',
  usedAi = false,
  provider = null,
  model = null,
  inputTokens = null,
  outputTokens = null,
  estimatedCost = null,
  metadata = {},
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertResult = await client.query(
      `INSERT INTO ai_usage_events
        (household_id, user_id, feature, source, used_ai, provider, model, input_tokens, output_tokens, estimated_cost, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        householdId,
        userId,
        feature,
        source,
        Boolean(usedAi),
        provider,
        model,
        inputTokens,
        outputTokens,
        estimatedCost,
        JSON.stringify(metadata || {}),
      ]
    );

    if (usedAi) {
      const { group } = await resolveUsageTier(householdId);
      if (group === 'lifetime') {
        await debitCredit(client, householdId, feature, insertResult.rows[0]?.id);
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
