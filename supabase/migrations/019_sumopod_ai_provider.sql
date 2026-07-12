-- Jadikan SumoPod AI provider utama, sambil mempertahankan Anthropic sebagai
-- alternatif untuk instalasi lama yang sudah mengisi key/model Anthropic.

UPDATE app_settings
SET value =
  '{
    "enabled": false,
    "provider": "sumopod",
    "sumopod_api_key": "",
    "sumopod_base_url": "https://ai.sumopod.com/v1",
    "sumopod_model": "gpt-4o-mini",
    "anthropic_api_key": "",
    "anthropic_model": "claude-sonnet-4-5",
    "insights_daily_limit": 3,
    "receipt_scan_monthly_limit": 30
  }'::jsonb
  || value
  || jsonb_build_object(
    'provider',
      CASE
        WHEN COALESCE(value->>'provider', '') = '' THEN 'sumopod'
        WHEN value->>'provider' = 'anthropic' AND COALESCE(value->>'anthropic_api_key', '') = '' THEN 'sumopod'
        ELSE value->>'provider'
      END,
    'sumopod_base_url', COALESCE(NULLIF(value->>'sumopod_base_url', ''), 'https://ai.sumopod.com/v1'),
    'sumopod_model', COALESCE(NULLIF(value->>'sumopod_model', ''), 'gpt-4o-mini'),
    'anthropic_model', COALESCE(NULLIF(value->>'anthropic_model', ''), NULLIF(value->>'model', ''), 'claude-sonnet-4-5')
  ),
  is_secret = true,
  updated_at = now()
WHERE key = 'ai';
