-- ============================================================
-- Migrasi: Kuota AI jadi plan-aware — sebelumnya semua paket
-- berbayar (monthly/semiannual/annual) berbagi limit 'paid_*' yang
-- sama. Sekarang dipecah 'short_*' (monthly/quarterly/semiannual)
-- vs 'annual_*' (annual). Lifetime tidak pakai kuota ini sama
-- sekali (lihat ai_credits di migrasi 036).
-- Target: PostgreSQL standalone (lihat supabase/schema-pg.sql)
-- Jalankan manual: psql -U keuangan_app -d keuangan -f supabase/migrations/037_ai_quota_plan_aware.sql
-- ============================================================

UPDATE app_settings
SET value = (value - 'paid_scan_monthly' - 'paid_insight_daily' - 'telegram_chat_daily' - 'whatsapp_chat_daily')
  || '{"short_scan_monthly": 20, "short_insight_daily": 2, "short_telegram_daily": 30, "short_whatsapp_daily": 20,
       "annual_scan_monthly": 40, "annual_insight_daily": 3, "annual_telegram_daily": 50, "annual_whatsapp_daily": 30}'::jsonb,
    updated_at = now()
WHERE key = 'ai_quota';

INSERT INTO app_settings (key, value, is_secret)
VALUES (
  'ai_quota',
  '{"trial_insight_total": 3, "trial_scan_total": 5, "free_insight_monthly": 1, "free_scan_monthly": 3, "short_scan_monthly": 20, "short_insight_daily": 2, "short_telegram_daily": 30, "short_whatsapp_daily": 20, "annual_scan_monthly": 40, "annual_insight_daily": 3, "annual_telegram_daily": 50, "annual_whatsapp_daily": 30}',
  false
)
ON CONFLICT (key) DO NOTHING;
