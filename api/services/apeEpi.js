import pool from '../db.js';
import { getSetting } from './appSettings.js';

const ASSET_CONFIG = {
  gold: { category: 'gold', brandField: 'gold_brand' },
  silver: { category: 'silver', brandField: 'silver_brand' },
};

function normalizeBaseUrl(url) {
  return String(url || 'https://ape.bisnisemasperak.com/api/v1').replace(/\/$/, '');
}

function toPositiveInt(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function applySettingsOverride(settings, override = {}) {
  const allowedFields = new Set([
    'enabled',
    'base_url',
    'api_key',
    'level',
    'gold_brand',
    'silver_brand',
    'cache_ttl_minutes',
    'max_daily_requests',
  ]);
  const next = { ...settings };
  for (const [field, value] of Object.entries(override || {})) {
    if (!allowedFields.has(field)) continue;
    if (field === 'api_key' && value === '') continue;
    next[field] = value;
  }
  return next;
}

function normalizePriceRow(assetType, row, fallbackBrand, level) {
  if (!row || typeof row !== 'object') return null;
  const price = Number(row.price);
  if (!Number.isFinite(price) || price <= 0) return null;

  return {
    asset_type: assetType,
    brand: String(row.brand || fallbackBrand).toUpperCase(),
    level: row.level?.code || row.level?.name || level,
    size: row.gramasi || '1',
    price_per_gram: price,
    currency: row.currency || 'IDR',
    date: row.date || null,
    fetched_at: new Date().toISOString(),
    raw: row,
  };
}

function parseGramasi(value) {
  const normalized = String(value || '').replace(',', '.').match(/\d+(\.\d+)?/)?.[0];
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function rowsFromPayload(payload) {
  return Array.isArray(payload?.data) ? payload.data : payload?.data ? [payload.data] : [];
}

function pickOneGramRow(payload) {
  const rows = rowsFromPayload(payload);
  return rows.find((row) => parseGramasi(row?.gramasi ?? row?.size) === 1) || rows[0] || null;
}

function shouldTryNextApeQuery(status) {
  return [400, 404].includes(status);
}

function appendSearchParam(url, key, value) {
  if (value !== undefined && value !== null && value !== '') {
    url.searchParams.set(key, value);
  }
}

async function fetchApeRows(settings, assetType, variant) {
  const config = ASSET_CONFIG[assetType];
  const brand = settings[config.brandField];
  const level = settings.level || 'konsumen';
  const url = new URL(`${normalizeBaseUrl(settings.base_url)}/prices`);
  const params = {
    page: '1',
    limit: variant.limit || '50',
    sort_by: variant.useSort ? 'date' : undefined,
    order: variant.useSort ? 'DESC' : undefined,
    currency: 'IDR',
    brand_name: brand,
    level: variant.useLevel ? level : undefined,
    size: variant.useSize ? '1' : undefined,
    product_category: variant.useCategory ? config.category : undefined,
  };
  Object.entries(params).forEach(([key, value]) => appendSearchParam(url, key, value));

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Api-Key': settings.api_key,
      'Content-Type': 'application/json',
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.meta?.message || `APE-EPI mengembalikan status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.variant = variant.label;
    throw error;
  }

  return { payload, brand, level, variant: variant.label };
}

async function fetchAssetPrice(settings, assetType) {
  const attempts = [
    { label: 'brand+level+size+category', useSort: true, useLevel: true, useSize: true, useCategory: true },
    { label: 'brand+level+size', useSort: true, useLevel: true, useSize: true, useCategory: false },
    { label: 'brand+level', useSort: true, useLevel: true, useSize: false, useCategory: false },
    { label: 'brand+level-no-sort', useSort: false, useLevel: true, useSize: false, useCategory: false },
    { label: 'brand-only', useSort: true, useLevel: false, useSize: false, useCategory: false },
  ];

  const failures = [];
  let lastBrand = settings[ASSET_CONFIG[assetType].brandField];
  let lastLevel = settings.level || 'konsumen';

  for (const attempt of attempts) {
    try {
      const fetched = await fetchApeRows(settings, assetType, attempt);
      lastBrand = fetched.brand;
      lastLevel = fetched.level;
      const row = pickOneGramRow(fetched.payload);
      const normalized = normalizePriceRow(assetType, row, fetched.brand, fetched.level);
      if (normalized) {
        return { ...normalized, query_variant: fetched.variant, total_rows: rowsFromPayload(fetched.payload).length };
      }
      failures.push(`${attempt.label}: harga 1 gram tidak ditemukan/0`);
    } catch (err) {
      failures.push(`${attempt.label}: ${err.message}`);
      if (!shouldTryNextApeQuery(err.status)) {
        throw err;
      }
    }
  }

  throw new Error(`Harga ${lastBrand} 1 gram level ${lastLevel} tidak berhasil dibaca dari APE-EPI. Percobaan: ${failures.join(' | ')}`);
}

async function readCachedPrices(ttlMinutes) {
  const result = await pool.query(
    `SELECT asset_type, brand, level_code as level, size, price_per_gram, currency,
            to_char(price_date, 'YYYY-MM-DD') as date, fetched_at
     FROM metal_price_cache
     WHERE fetched_at >= now() - ($1::int * interval '1 minute')`,
    [ttlMinutes]
  );
  return Object.fromEntries(result.rows.map((row) => [row.asset_type, row]));
}

async function readLatestCachedPrices() {
  const result = await pool.query(
    `SELECT asset_type, brand, level_code as level, size, price_per_gram, currency,
            to_char(price_date, 'YYYY-MM-DD') as date, fetched_at
     FROM metal_price_cache`
  );
  return Object.fromEntries(result.rows.map((row) => [row.asset_type, row]));
}

async function writeCachedPrice(price) {
  await pool.query(
    `INSERT INTO metal_price_cache
      (asset_type, brand, level_code, size, price_per_gram, currency, price_date, fetched_at, raw_payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8)
     ON CONFLICT (asset_type) DO UPDATE SET
      brand = EXCLUDED.brand,
      level_code = EXCLUDED.level_code,
      size = EXCLUDED.size,
      price_per_gram = EXCLUDED.price_per_gram,
      currency = EXCLUDED.currency,
      price_date = EXCLUDED.price_date,
      fetched_at = now(),
      raw_payload = EXCLUDED.raw_payload`,
    [
      price.asset_type,
      price.brand,
      price.level,
      price.size,
      price.price_per_gram,
      price.currency,
      price.date,
      JSON.stringify(price.raw || {}),
    ]
  );
}

async function reserveDailyRefresh(maxDailyRequests) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const todayResult = await client.query(`SELECT (now() AT TIME ZONE 'Asia/Jakarta')::date AS today`);
    const today = todayResult.rows[0].today;
    const existing = await client.query(
      `SELECT request_count
       FROM integration_request_logs
       WHERE integration_key = $1 AND request_date = $2
       FOR UPDATE`,
      ['ape_epi', today]
    );

    const currentCount = Number(existing.rows[0]?.request_count || 0);
    if (currentCount >= maxDailyRequests) {
      await client.query('COMMIT');
      return { allowed: false, count: currentCount, max: maxDailyRequests };
    }

    const nextCount = currentCount + 1;
    await client.query(
      `INSERT INTO integration_request_logs (integration_key, request_date, request_count, last_requested_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (integration_key, request_date)
       DO UPDATE SET request_count = $3, last_requested_at = now()`,
      ['ape_epi', today, nextCount]
    );
    await client.query('COMMIT');
    return { allowed: true, count: nextCount, max: maxDailyRequests };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getCurrentMetalPrices({ forceRefresh = false, bypassDailyLimit = false, settingsOverride = null } = {}) {
  const settings = applySettingsOverride(await getSetting('ape_epi'), settingsOverride);
  const ttlMinutes = toPositiveInt(settings.cache_ttl_minutes, 30);
  const maxDailyRequests = toPositiveInt(settings.max_daily_requests, 3);

  if (!settings.enabled) {
    return { enabled: false, gold: null, silver: null };
  }
  if (!settings.api_key) {
    return { enabled: false, gold: null, silver: null, error: 'API Key APE-EPI belum diatur' };
  }

  if (!forceRefresh) {
    const cached = await readCachedPrices(ttlMinutes);
    if (cached.gold && cached.silver) {
      return { enabled: true, gold: cached.gold, silver: cached.silver, cached: true };
    }
  }

  const reservation = bypassDailyLimit
    ? { allowed: true, count: null, max: maxDailyRequests }
    : await reserveDailyRefresh(maxDailyRequests);
  if (!reservation.allowed) {
    const latest = await readLatestCachedPrices();
    if (!latest.gold || !latest.silver) {
      return {
        enabled: false,
        gold: null,
        silver: null,
        cached: false,
        refresh_limited: true,
        daily_request_count: reservation.count,
        daily_request_limit: reservation.max,
        error: 'Batas refresh harga harian APE-EPI sudah tercapai dan cache harga belum tersedia.',
      };
    }
    return {
      enabled: true,
      gold: latest.gold || null,
      silver: latest.silver || null,
      cached: true,
      refresh_limited: true,
      daily_request_count: reservation.count,
      daily_request_limit: reservation.max,
    };
  }

  const [gold, silver] = await Promise.all([
    fetchAssetPrice(settings, 'gold'),
    fetchAssetPrice(settings, 'silver'),
  ]);

  await Promise.all([writeCachedPrice(gold), writeCachedPrice(silver)]);
  return {
    enabled: true,
    gold,
    silver,
    cached: false,
    daily_request_count: reservation.count,
    daily_request_limit: reservation.max,
  };
}
