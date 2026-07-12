-- Integrasi APE-EPI Auto Price Engine dan cache harga logam

CREATE TABLE IF NOT EXISTS metal_price_cache (
  asset_type TEXT PRIMARY KEY CHECK (asset_type IN ('gold','silver')),
  brand TEXT NOT NULL,
  level_code TEXT,
  size TEXT NOT NULL DEFAULT '1',
  price_per_gram NUMERIC NOT NULL CHECK (price_per_gram >= 0),
  currency TEXT NOT NULL DEFAULT 'IDR',
  price_date DATE,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_metal_price_cache_fetched_at
  ON metal_price_cache (fetched_at DESC);

INSERT INTO app_settings (key, value, is_secret)
VALUES (
  'ape_epi',
  '{"enabled": false, "base_url": "https://ape.bisnisemasperak.com/api/v1", "api_key": "", "level": "konsumen", "gold_brand": "GOLDGRAM", "silver_brand": "SILVERGRAM", "cache_ttl_minutes": 30}',
  true
)
ON CONFLICT (key) DO NOTHING;
