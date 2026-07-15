import pool from '../db.js';
import { getSetting } from './appSettings.js';

const PAID_PLANS = new Set(['monthly', 'semiannual', 'annual']);

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

export async function resolveUsageTier(householdId) {
  const subscription = await getSubscription(householdId);
  const plan = subscription?.plan || 'free';
  const active = subscription?.status === 'active';

  if (active && PAID_PLANS.has(plan)) return { tier: plan, family: 'paid', subscription };
  if (active && plan === 'trial') return { tier: 'trial', family: 'trial', subscription };
  return { tier: 'free', family: 'free', subscription };
}

export async function getAiQuotaConfig() {
  const quota = await getSetting('ai_quota');
  return {
    trial_insight_total: toNonNegativeInt(quota.trial_insight_total, 3),
    trial_scan_total: toNonNegativeInt(quota.trial_scan_total, 5),
    free_insight_monthly: toNonNegativeInt(quota.free_insight_monthly, 1),
    free_scan_monthly: toNonNegativeInt(quota.free_scan_monthly, 3),
    paid_insight_daily: toNonNegativeInt(quota.paid_insight_daily, 3),
    paid_scan_monthly: toNonNegativeInt(quota.paid_scan_monthly, 30),
    telegram_chat_daily: toNonNegativeInt(quota.telegram_chat_daily, 100),
    whatsapp_chat_daily: toNonNegativeInt(quota.whatsapp_chat_daily, 50),
  };
}

function chatDailyLimitFor(feature, quota) {
  if (feature === 'telegram_chat') return quota.telegram_chat_daily;
  if (feature === 'whatsapp_chat') return quota.whatsapp_chat_daily;
  return 0;
}

function scopeFor(feature, family) {
  if (family === 'paid' && feature === 'ai_insight') return 'day';
  if (family === 'trial') return 'total';
  return 'month';
}

function limitFor(feature, family, quota) {
  if (feature === 'receipt_scan') {
    if (family === 'paid') return quota.paid_scan_monthly;
    if (family === 'trial') return quota.trial_scan_total;
    return quota.free_scan_monthly;
  }

  if (family === 'paid') return quota.paid_insight_daily;
  if (family === 'trial') return quota.trial_insight_total;
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
  const [{ family, tier }, quota] = await Promise.all([
    resolveUsageTier(householdId),
    getAiQuotaConfig(),
  ]);
  const scope = scopeFor(feature, family);
  const limit = limitFor(feature, family, quota);
  const used = await countUsage(householdId, feature, scope);

  return {
    feature,
    tier,
    family,
    scope,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    allowed: used < limit,
  };
}

export async function assertQuotaAvailable(householdId, feature, label) {
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
  const quota = await getAiQuotaConfig();
  const limit = chatDailyLimitFor(feature, quota);
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
  const quota = await getAiQuotaConfig();
  const limit = chatDailyLimitFor(feature, quota);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `ai_usage:${feature}:${userId}:${new Date().toISOString().slice(0, 10)}`,
    ]);

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
  await pool.query(
    `INSERT INTO ai_usage_events
      (household_id, user_id, feature, source, used_ai, provider, model, input_tokens, output_tokens, estimated_cost, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
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
}
