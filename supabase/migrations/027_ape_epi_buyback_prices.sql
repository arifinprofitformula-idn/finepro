ALTER TABLE metal_price_cache DROP CONSTRAINT IF EXISTS metal_price_cache_asset_type_check;
ALTER TABLE metal_price_cache ADD CONSTRAINT metal_price_cache_asset_type_check
  CHECK (asset_type IN ('gold', 'silver', 'gold_buyback', 'silver_buyback'));
