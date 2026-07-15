-- ============================================================
-- Migrasi: Kuota harian chat AI WhatsApp per user (mirror Telegram)
-- Memperbaiki CHECK constraint ai_usage_events yang belum
-- mengizinkan feature 'whatsapp_chat' dan source 'whatsapp',
-- sehingga reservasi kuota chat WhatsApp selama ini selalu gagal insert.
-- Target: PostgreSQL standalone (lihat supabase/schema-pg.sql)
-- Jalankan manual: psql -U keuangan_app -d keuangan -f supabase/migrations/032_whatsapp_chat_ai_quota.sql
-- ============================================================

ALTER TABLE ai_usage_events
  DROP CONSTRAINT IF EXISTS ai_usage_events_feature_check;

ALTER TABLE ai_usage_events
  ADD CONSTRAINT ai_usage_events_feature_check
  CHECK (feature IN ('receipt_scan','ai_insight','telegram_chat','whatsapp_chat'));

ALTER TABLE ai_usage_events
  DROP CONSTRAINT IF EXISTS ai_usage_events_source_check;

ALTER TABLE ai_usage_events
  ADD CONSTRAINT ai_usage_events_source_check
  CHECK (source IN ('web','telegram','whatsapp'));

UPDATE app_settings
SET value = COALESCE(value, '{}'::jsonb) || '{"whatsapp_chat_daily": 50}'::jsonb,
    updated_at = now()
WHERE key = 'ai_quota'
  AND NOT (COALESCE(value, '{}'::jsonb) ? 'whatsapp_chat_daily');

INSERT INTO app_settings (key, value, is_secret)
VALUES (
  'ai_quota',
  '{"trial_insight_total": 3, "trial_scan_total": 5, "free_insight_monthly": 1, "free_scan_monthly": 3, "paid_insight_daily": 3, "paid_scan_monthly": 30, "telegram_chat_daily": 100, "whatsapp_chat_daily": 50}',
  false
)
ON CONFLICT (key) DO NOTHING;
