-- ============================================================
-- Migrasi: Kredit AI akumulatif untuk paket Lifetime — 4 saldo
-- terpisah per fitur AI (scan struk, AI insight, chat Telegram,
-- chat WhatsApp), tidak reset periodik seperti paket lain.
-- Target: PostgreSQL standalone (lihat supabase/schema-pg.sql)
-- Jalankan manual: psql -U keuangan_app -d keuangan -f supabase/migrations/036_ai_credit_lifetime.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_credits (
  household_id uuid REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  feature text NOT NULL CHECK (feature IN ('receipt_scan','ai_insight','telegram_chat','whatsapp_chat')),
  balance integer NOT NULL DEFAULT 0,
  granted_total integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (household_id, feature)
);

CREATE TABLE IF NOT EXISTS ai_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  feature text NOT NULL CHECK (feature IN ('receipt_scan','ai_insight','telegram_chat','whatsapp_chat')),
  type text NOT NULL CHECK (type IN ('grant_initial','topup','debit')),
  amount integer NOT NULL, -- positif utk grant_initial/topup, negatif utk debit
  ai_usage_event_id uuid REFERENCES ai_usage_events(id) ON DELETE SET NULL,
  payment_order_id text REFERENCES payments(order_id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_credit_tx_household ON ai_credit_transactions (household_id, created_at DESC);

INSERT INTO app_settings (key, value, is_secret)
VALUES (
  'ai_credit',
  '{"lifetime_grant": {"receipt_scan": 480, "ai_insight": 1095, "telegram_chat": 18250, "whatsapp_chat": 10950}, "topup_grant": {"receipt_scan": 240, "ai_insight": 546, "telegram_chat": 9100, "whatsapp_chat": 5460}, "topup_price": 124500}',
  false
)
ON CONFLICT (key) DO NOTHING;
