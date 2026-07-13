-- ============================================================
-- Migrasi: Kuota harian chat AI Telegram per user
-- Target: PostgreSQL standalone (lihat supabase/schema-pg.sql)
-- Jalankan manual: psql -U keuangan_app -d keuangan -f supabase/migrations/028_telegram_chat_ai_quota.sql
-- ============================================================

ALTER TABLE ai_usage_events
  DROP CONSTRAINT IF EXISTS ai_usage_events_feature_check;

ALTER TABLE ai_usage_events
  ADD CONSTRAINT ai_usage_events_feature_check
  CHECK (feature IN ('receipt_scan','ai_insight','telegram_chat'));

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_feature_created
  ON ai_usage_events (user_id, feature, created_at DESC);

UPDATE app_settings
SET value = COALESCE(value, '{}'::jsonb) || '{"telegram_chat_daily": 100}'::jsonb,
    updated_at = now()
WHERE key = 'ai_quota'
  AND NOT (COALESCE(value, '{}'::jsonb) ? 'telegram_chat_daily');

INSERT INTO app_settings (key, value, is_secret)
VALUES (
  'ai_quota',
  '{"trial_insight_total": 3, "trial_scan_total": 5, "free_insight_monthly": 1, "free_scan_monthly": 3, "paid_insight_daily": 3, "paid_scan_monthly": 30, "telegram_chat_daily": 100}',
  false
)
ON CONFLICT (key) DO NOTHING;
