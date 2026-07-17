-- ============================================================
-- Migrasi: Restrukturisasi paket (tambah quarterly & lifetime,
-- semiannual tidak dijual lagi tapi tetap valid utk histori) +
-- penanda harga promo Early Access per pembayaran.
-- Target: PostgreSQL standalone (lihat supabase/schema-pg.sql)
-- Jalankan manual: psql -U keuangan_app -d keuangan -f supabase/migrations/035_pricing_promo.sql
-- ============================================================

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_plan_check;
ALTER TABLE payments ADD CONSTRAINT payments_plan_check
  CHECK (plan IN ('monthly','semiannual','quarterly','annual','lifetime','ai_credit_topup'));

ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_promo boolean NOT NULL DEFAULT false;

INSERT INTO app_settings (key, value, is_secret)
VALUES (
  'pricing',
  '{"promo_start_date": null, "promo_days": 30, "promo_max_users": {"annual": 500, "lifetime": 500}, "normal": {"monthly": 29000, "quarterly": 79000, "annual": 249000, "lifetime": 649000}, "promo": {"annual": 149000, "lifetime": 499000}}',
  false
)
ON CONFLICT (key) DO NOTHING;
