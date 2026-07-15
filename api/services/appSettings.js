import pool from '../db.js';

const DEFAULTS = {
  mailketing: {
    enabled: false,
    api_token: '',
    from_email: '',
    from_name: 'Finepro',
    list_id: '',
  },
  midtrans: {
    enabled: false,
    is_production: false,
    server_key: '',
    client_key: '',
  },
  xendit: {
    enabled: false,
    is_production: false,
    secret_key: '',
    callback_verification_token: '',
  },
  payment_gateway: {
    active: 'midtrans',
  },
  manual_payment: {
    enabled: false,
    bank_name: '',
    account_number: '',
    account_name: '',
    instructions: '',
  },
  ai: {
    enabled: false,
    provider: 'sumopod',
    sumopod_api_key: '',
    sumopod_base_url: 'https://ai.sumopod.com/v1',
    sumopod_model: 'gpt-4o-mini',
    anthropic_api_key: '',
    anthropic_model: 'claude-sonnet-4-5',
    insights_daily_limit: 3,
    receipt_scan_monthly_limit: 30,
  },
  ai_quota: {
    trial_insight_total: 3,
    trial_scan_total: 5,
    free_insight_monthly: 1,
    free_scan_monthly: 3,
    paid_insight_daily: 3,
    paid_scan_monthly: 30,
    telegram_chat_daily: 100,
    whatsapp_chat_daily: 50,
  },
  ape_epi: {
    enabled: false,
    base_url: 'https://ape.bisnisemasperak.com/api/v1',
    api_key: '',
    level: 'konsumen',
    gold_brand: 'GOLDGRAM',
    silver_brand: 'SILVERGRAM',
    cache_ttl_minutes: 30,
    max_daily_requests: 3,
  },
  web_push: {
    enabled: true,
    vapid_public_key: '',
    vapid_private_key: '',
    vapid_subject: 'mailto:admin@finepro.my.id',
  },
  telegram: {
    enabled: false,
    bot_token: '',
    bot_username: '',
    n8n_shared_secret: '',
  },
  whatsapp: {
    enabled: false,
    token: '',
    phone_number_id: '',
    verify_token: '',
    business_phone: '',
  },
};

const SECRET_FIELDS = {
  mailketing: ['api_token'],
  midtrans: ['server_key', 'client_key'],
  xendit: ['secret_key', 'callback_verification_token'],
  ai: ['sumopod_api_key', 'anthropic_api_key'],
  ape_epi: ['api_key'],
  web_push: ['vapid_private_key'],
  telegram: ['bot_token', 'n8n_shared_secret'],
  whatsapp: ['token', 'verify_token'],
};

const ALLOWED_FIELDS = {
  mailketing: ['enabled', 'api_token', 'from_email', 'from_name', 'list_id'],
  midtrans: ['enabled', 'is_production', 'server_key', 'client_key'],
  xendit: ['enabled', 'is_production', 'secret_key', 'callback_verification_token'],
  payment_gateway: ['active'],
  manual_payment: ['enabled', 'bank_name', 'account_number', 'account_name', 'instructions'],
  ai: [
    'enabled',
    'provider',
    'sumopod_api_key',
    'sumopod_base_url',
    'sumopod_model',
    'anthropic_api_key',
    'anthropic_model',
    'model',
    'insights_daily_limit',
    'receipt_scan_monthly_limit'
  ],
  ai_quota: [
    'trial_insight_total',
    'trial_scan_total',
    'free_insight_monthly',
    'free_scan_monthly',
    'paid_insight_daily',
    'paid_scan_monthly',
    'telegram_chat_daily',
    'whatsapp_chat_daily'
  ],
  ape_epi: ['enabled', 'base_url', 'api_key', 'level', 'gold_brand', 'silver_brand', 'cache_ttl_minutes', 'max_daily_requests'],
  web_push: ['enabled', 'vapid_public_key', 'vapid_private_key', 'vapid_subject'],
  telegram: ['enabled', 'bot_token', 'bot_username', 'n8n_shared_secret'],
  whatsapp: ['enabled', 'token', 'phone_number_id', 'verify_token', 'business_phone'],
};

const STORED_SETTING_SIGNALS = {
  mailketing: ['enabled', 'api_token', 'from_email'],
};

function envFallback(key) {
  if (key === 'mailketing') {
    return {
      enabled: Boolean(process.env.MAILKETING_API_TOKEN && process.env.MAILKETING_FROM_EMAIL),
      api_token: process.env.MAILKETING_API_TOKEN || '',
      from_email: process.env.MAILKETING_FROM_EMAIL || '',
      from_name: process.env.MAILKETING_FROM_NAME || DEFAULTS.mailketing.from_name,
      list_id: process.env.MAILKETING_LIST_ID || '',
    };
  }
  if (key === 'midtrans') {
    const serverKey = process.env.MIDTRANS_SERVER_KEY || '';
    const clientKey = process.env.MIDTRANS_CLIENT_KEY || '';
    const hasServerKey = Boolean(serverKey && serverKey !== 'isi-server-key-midtrans');
    const hasClientKey = Boolean(clientKey && clientKey !== 'isi-client-key-midtrans');
    return {
      enabled: hasServerKey && hasClientKey,
      is_production: process.env.MIDTRANS_IS_PRODUCTION === 'true',
      server_key: serverKey,
      client_key: clientKey,
    };
  }
  if (key === 'xendit') {
    const secretKey = process.env.XENDIT_SECRET_KEY || '';
    const callbackToken = process.env.XENDIT_CALLBACK_TOKEN || '';
    return {
      enabled: Boolean(secretKey && callbackToken),
      is_production: process.env.XENDIT_IS_PRODUCTION === 'true',
      secret_key: secretKey,
      callback_verification_token: callbackToken,
    };
  }
  if (key === 'ai') {
    const sumopodKey = process.env.SUMOPOD_API_KEY || '';
    const anthropicKey = process.env.ANTHROPIC_API_KEY || '';
    const hasSumopod = Boolean(sumopodKey && sumopodKey !== 'isi-sumopod-api-key');
    const hasAnthropic = Boolean(anthropicKey && anthropicKey !== 'isi-anthropic-api-key');
    return {
      enabled: hasSumopod || hasAnthropic,
      provider: process.env.AI_PROVIDER || (hasAnthropic && !hasSumopod ? 'anthropic' : 'sumopod'),
      sumopod_api_key: sumopodKey,
      sumopod_base_url: process.env.SUMOPOD_BASE_URL || DEFAULTS.ai.sumopod_base_url,
      sumopod_model: process.env.SUMOPOD_MODEL || DEFAULTS.ai.sumopod_model,
      anthropic_api_key: anthropicKey,
      anthropic_model: process.env.ANTHROPIC_MODEL || DEFAULTS.ai.anthropic_model,
      model: process.env.SUMOPOD_MODEL || process.env.ANTHROPIC_MODEL || DEFAULTS.ai.sumopod_model,
      insights_daily_limit: Number(process.env.AI_INSIGHTS_DAILY_LIMIT || DEFAULTS.ai.insights_daily_limit),
      receipt_scan_monthly_limit: Number(process.env.RECEIPT_SCAN_MONTHLY_LIMIT || DEFAULTS.ai.receipt_scan_monthly_limit),
    };
  }
  if (key === 'web_push') {
    return {
      enabled: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
      vapid_public_key: process.env.VAPID_PUBLIC_KEY || '',
      vapid_private_key: process.env.VAPID_PRIVATE_KEY || '',
      vapid_subject: process.env.VAPID_SUBJECT || DEFAULTS.web_push.vapid_subject,
    };
  }
  if (key === 'ape_epi') {
    return {
      enabled: Boolean(process.env.APE_EPI_API_KEY),
      base_url: process.env.APE_EPI_BASE_URL || DEFAULTS.ape_epi.base_url,
      api_key: process.env.APE_EPI_API_KEY || '',
      level: process.env.APE_EPI_LEVEL || DEFAULTS.ape_epi.level,
      gold_brand: process.env.APE_EPI_GOLD_BRAND || DEFAULTS.ape_epi.gold_brand,
      silver_brand: process.env.APE_EPI_SILVER_BRAND || DEFAULTS.ape_epi.silver_brand,
      cache_ttl_minutes: Number(process.env.APE_EPI_CACHE_TTL_MINUTES || DEFAULTS.ape_epi.cache_ttl_minutes),
      max_daily_requests: Number(process.env.APE_EPI_MAX_DAILY_REQUESTS || DEFAULTS.ape_epi.max_daily_requests),
    };
  }
  if (key === 'telegram') {
    return {
      enabled: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_N8N_SECRET),
      bot_token: process.env.TELEGRAM_BOT_TOKEN || '',
      bot_username: process.env.TELEGRAM_BOT_USERNAME || '',
      n8n_shared_secret: process.env.TELEGRAM_N8N_SECRET || '',
    };
  }
  if (key === 'whatsapp') {
    return {
      enabled: Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_VERIFY_TOKEN),
      token: process.env.WHATSAPP_TOKEN || '',
      phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      verify_token: process.env.WHATSAPP_VERIFY_TOKEN || '',
      business_phone: process.env.WHATSAPP_BUSINESS_PHONE || '',
    };
  }
  return {};
}

function hasUsefulValue(key, value) {
  if (!value || typeof value !== 'object') return false;
  const signalFields = STORED_SETTING_SIGNALS[key];
  if (signalFields) {
    return signalFields.some((field) => {
      const current = value[field];
      return field === 'enabled' ? current === true : Boolean(current);
    });
  }

  const secrets = SECRET_FIELDS[key] || [];
  return Object.entries(value).some(([field, current]) => {
    if (field === 'enabled') return current === true;
    if (secrets.includes(field)) return Boolean(current);
    return current !== '' && current !== null && current !== undefined;
  });
}

export async function getSetting(key) {
  const result = await pool.query('SELECT value, updated_by FROM app_settings WHERE key = $1', [key]);
  const row = result.rows[0];
  const stored = row?.value || {};
  const shouldUseStored = Boolean(row?.updated_by) || hasUsefulValue(key, stored);
  const merged = { ...(DEFAULTS[key] || {}), ...envFallback(key), ...(shouldUseStored ? stored : {}) };
  return merged;
}

export async function getAllSettings() {
  const keys = Object.keys(DEFAULTS);
  const entries = await Promise.all(keys.map(async (key) => [key, await getSetting(key)]));
  return Object.fromEntries(entries);
}

export function publicSetting(key, value) {
  const secretFields = SECRET_FIELDS[key] || [];
  const publicValue = { ...value };
  for (const field of secretFields) {
    publicValue[`${field}_configured`] = Boolean(value?.[field]);
    publicValue[`${field}_masked`] = value?.[field] ? '••••••••' : '';
    delete publicValue[field];
  }
  return publicValue;
}

export async function updateSetting(key, patch, userId) {
  const current = await getSetting(key);
  const secretFields = SECRET_FIELDS[key] || [];
  const allowedFields = new Set(ALLOWED_FIELDS[key] || []);
  const next = { ...current };

  for (const [field, value] of Object.entries(patch || {})) {
    if (!allowedFields.has(field)) continue;
    if (secretFields.includes(field) && value === '') continue;
    next[field] = value;
  }

  await pool.query(
    `INSERT INTO app_settings (key, value, is_secret, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, is_secret = EXCLUDED.is_secret, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [key, JSON.stringify(next), secretFields.length > 0, userId]
  );

  return next;
}

export async function auditAdminAction(adminUserId, action, targetType, targetId, metadata = {}) {
  await pool.query(
    `INSERT INTO admin_audit_logs (admin_user_id, action, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [adminUserId, action, targetType || null, targetId || null, JSON.stringify(metadata)]
  );
}
