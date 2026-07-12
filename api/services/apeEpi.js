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

function normalizePriceRow(assetType, row, fallbackBrand, level) {
  if (!row || typeof row !== 'object') return null;
  const price = Number(row.price);
  if (!Number.isFinite(price) || price < 0) return null;

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

async function fetchAssetPrice(settings, assetType) {
  const config = ASSET_CONFIG[assetType];
  const brand = settings[config.brandField];
  const level = settings.level || 'konsumen';
  const url = new URL(`${normalizeBaseUrl(settings.base_url)}/prices`);
  url.searchParams.set('page', '1');
  url.searchParams.set('limit', '1');
  url.searchParams.set('sort_by', 'date');
  url.searchParams.set('order', 'DESC');
  url.searchParams.set('currency', 'IDR');
  url.searchParams.set('brand_name', brand);
  url.searchParams.set('level', level);
  url.searchParams.set('size', '1');
  url.searchParams.set('product_category', config.category);

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
    throw error;
  }

  const row = Array.isArray(payload?.data) ? payload.data[0] : payload?.data;
  const normalized = normalizePriceRow(assetType, row, brand, level);
  if (!normalized) {
    throw new Error(`Harga ${brand} tidak ditemukan dari APE-EPI`);
  }
  return normalized;
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

export async function getCurrentMetalPrices({ forceRefresh = false } = {}) {
  const settings = await getSetting('ape_epi');
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

  const reservation = await reserveDailyRefresh(maxDailyRequests);
  if (!reservation.allowed) {
    const latest = await readLatestCachedPrices();
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
