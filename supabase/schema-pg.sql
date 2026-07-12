-- ============================================================
-- Skema Database Finepro — PostgreSQL Standalone
-- Baseline final untuk fresh install.
--
-- Untuk database baru, jalankan file ini saja sebagai schema awal.
-- Folder migrations tetap dipakai untuk upgrade database lama.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 0. Pengguna aplikasi
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user','admin','super_admin')),
  google_id TEXT UNIQUE,
  provider TEXT NOT NULL DEFAULT 'local'
    CHECK (provider IN ('local','google')),
  telegram_id BIGINT UNIQUE,
  telegram_username TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 1. Household/workspace
CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Keluarga Saya',
  owner_id UUID REFERENCES users(id) NOT NULL,
  household_type TEXT NOT NULL DEFAULT 'family'
    CHECK (household_type IN ('family','student','individual')),
  monthly_income_day INTEGER
    CHECK (monthly_income_day IS NULL OR (monthly_income_day BETWEEN 1 AND 31)),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Anggota household
CREATE TABLE IF NOT EXISTS household_members (
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (household_id, user_id)
);

-- 3. Undangan anggota household
CREATE TABLE IF NOT EXISTS household_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  invited_email TEXT NOT NULL,
  invited_by UUID REFERENCES users(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired')),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days'
);

-- 4. Status langganan
CREATE TABLE IF NOT EXISTS subscriptions (
  household_id UUID REFERENCES households(id) ON DELETE CASCADE PRIMARY KEY,
  plan TEXT NOT NULL DEFAULT 'trial',
  status TEXT NOT NULL DEFAULT 'active',
  current_period_end DATE,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Dompet
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Transaksi keuangan
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES users(id) NOT NULL,
  wallet_id UUID REFERENCES wallets(id),
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  note TEXT,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'receipt_scan', 'telegram')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Transfer antar dompet
CREATE TABLE IF NOT EXISTS wallet_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  from_wallet_id UUID REFERENCES wallets(id) NOT NULL,
  to_wallet_id UUID REFERENCES wallets(id) NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  note TEXT,
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (from_wallet_id <> to_wallet_id)
);

-- 8. Budget per kategori
CREATE TABLE IF NOT EXISTS budgets (
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (household_id, category)
);

-- 9. Kategori dinamis per household
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  name TEXT NOT NULL,
  system_key TEXT,
  sort_order INT DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (household_id, type, name)
);

-- 10. Tagihan
CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  due_date DATE NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Pembayaran langganan
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  order_id TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('monthly','semiannual','annual')),
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ
);

-- 12. Arisan
CREATE TABLE IF NOT EXISTS arisan_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  amount_per_period NUMERIC NOT NULL CHECK (amount_per_period >= 0),
  frequency_label TEXT NOT NULL DEFAULT 'Bulanan',
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS arisan_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES arisan_groups(id) ON DELETE CASCADE NOT NULL,
  participant_name TEXT NOT NULL,
  turn_order INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS arisan_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES arisan_groups(id) ON DELETE CASCADE NOT NULL,
  participant_id UUID REFERENCES arisan_participants(id) ON DELETE CASCADE NOT NULL,
  period_label TEXT NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT false,
  paid_date TIMESTAMPTZ,
  UNIQUE (participant_id, period_label)
);

CREATE TABLE IF NOT EXISTS arisan_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arisan_group_id UUID REFERENCES arisan_groups(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  member_name TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  is_payout BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 13. Push notification
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 14. AI insight dan scan struk
CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  stats_snapshot JSONB NOT NULL,
  narrative_text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS receipt_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 15. Google/local password reset
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 16. Telegram integration
CREATE TABLE IF NOT EXISTS telegram_link_codes (
  code TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS telegram_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES users(id) NOT NULL,
  telegram_id BIGINT NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'receipt' CHECK (doc_type IN ('receipt', 'transfer')),
  image_path TEXT,
  raw_text TEXT,
  extracted JSONB,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 17. Konfigurasi aplikasi global untuk admin panel
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_secret BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES users(id) NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Fungsi & Trigger
-- ============================================================

CREATE OR REPLACE FUNCTION seed_default_categories(p_household_id UUID, p_type TEXT)
RETURNS void AS $$
BEGIN
  IF p_type = 'family' THEN
    INSERT INTO categories (household_id, type, name, is_default, sort_order, system_key) VALUES
      (p_household_id, 'expense', 'Rumah Tangga', true, 1, NULL),
      (p_household_id, 'expense', 'Cicilan/Utang', true, 2, NULL),
      (p_household_id, 'expense', 'Pendidikan Anak', true, 3, NULL),
      (p_household_id, 'expense', 'Transportasi', true, 4, NULL),
      (p_household_id, 'expense', 'Kesehatan', true, 5, NULL),
      (p_household_id, 'expense', 'Tabungan & Investasi', true, 6, NULL),
      (p_household_id, 'expense', 'Zakat & Sedekah', true, 7, 'zakat_sedekah'),
      (p_household_id, 'expense', 'Hiburan', true, 8, NULL),
      (p_household_id, 'expense', 'Lainnya', true, 9, NULL),
      (p_household_id, 'income', 'Gaji/Usaha', true, 1, NULL),
      (p_household_id, 'income', 'Coaching & Mentoring', true, 2, NULL),
      (p_household_id, 'income', 'Produk Digital', true, 3, NULL),
      (p_household_id, 'income', 'Investasi', true, 4, NULL),
      (p_household_id, 'income', 'Lainnya', true, 5, NULL);

  ELSIF p_type = 'student' THEN
    INSERT INTO categories (household_id, type, name, is_default, sort_order, system_key) VALUES
      (p_household_id, 'expense', 'Kos/Kontrakan', true, 1, NULL),
      (p_household_id, 'expense', 'Uang Makan', true, 2, NULL),
      (p_household_id, 'expense', 'Transportasi (Ojol/Motor)', true, 3, NULL),
      (p_household_id, 'expense', 'Buku & Alat Kuliah', true, 4, NULL),
      (p_household_id, 'expense', 'Kuota & Internet', true, 5, NULL),
      (p_household_id, 'expense', 'Nongkrong & Hiburan', true, 6, NULL),
      (p_household_id, 'expense', 'Tabungan', true, 7, NULL),
      (p_household_id, 'expense', 'Zakat & Sedekah', true, 8, 'zakat_sedekah'),
      (p_household_id, 'expense', 'Lainnya', true, 9, NULL),
      (p_household_id, 'income', 'Uang Kiriman Ortu', true, 1, NULL),
      (p_household_id, 'income', 'Beasiswa', true, 2, NULL),
      (p_household_id, 'income', 'Kerja Part-time/Freelance', true, 3, NULL),
      (p_household_id, 'income', 'Lainnya', true, 4, NULL);

  ELSE
    INSERT INTO categories (household_id, type, name, is_default, sort_order, system_key) VALUES
      (p_household_id, 'expense', 'Kebutuhan Pokok', true, 1, NULL),
      (p_household_id, 'expense', 'Transportasi', true, 2, NULL),
      (p_household_id, 'expense', 'Kesehatan', true, 3, NULL),
      (p_household_id, 'expense', 'Tabungan & Investasi', true, 4, NULL),
      (p_household_id, 'expense', 'Hiburan', true, 5, NULL),
      (p_household_id, 'expense', 'Zakat & Sedekah', true, 6, 'zakat_sedekah'),
      (p_household_id, 'expense', 'Lainnya', true, 7, NULL),
      (p_household_id, 'income', 'Gaji/Usaha', true, 1, NULL),
      (p_household_id, 'income', 'Lainnya', true, 2, NULL);
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION handle_new_household()
RETURNS trigger AS $$
DECLARE
  default_wallet_id UUID;
BEGIN
  INSERT INTO household_members (household_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');

  INSERT INTO subscriptions (household_id, plan, status, current_period_end)
  VALUES (NEW.id, 'trial', 'active', CURRENT_DATE + INTERVAL '14 days');

  PERFORM seed_default_categories(NEW.id, NEW.household_type);

  INSERT INTO wallets (household_id, name, is_default)
  VALUES (NEW.id, 'Tunai', true)
  RETURNING id INTO default_wallet_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_household_created ON households;
CREATE TRIGGER on_household_created
  AFTER INSERT ON households
  FOR EACH ROW EXECUTE FUNCTION handle_new_household();

-- ============================================================
-- Index untuk performa
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_household_members_user ON household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_household_invites_email ON household_invites (LOWER(invited_email));
CREATE INDEX IF NOT EXISTS idx_household_invites_household ON household_invites (household_id);
CREATE INDEX IF NOT EXISTS idx_wallets_household ON wallets (household_id);
CREATE INDEX IF NOT EXISTS idx_transactions_household_date ON transactions(household_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(household_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON transactions (wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transfers_household ON wallet_transfers (household_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_household_system_key
  ON categories (household_id, system_key)
  WHERE system_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bills_household ON bills (household_id);
CREATE INDEX IF NOT EXISTS idx_bills_due_date ON bills (household_id, due_date);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_household ON payments (household_id);
CREATE INDEX IF NOT EXISTS idx_arisan_groups_household ON arisan_groups (household_id);
CREATE INDEX IF NOT EXISTS idx_arisan_participants_group ON arisan_participants (group_id);
CREATE INDEX IF NOT EXISTS idx_arisan_payments_group_period ON arisan_payments (group_id, period_label);
CREATE INDEX IF NOT EXISTS idx_arisan_entries_group_date ON arisan_entries (arisan_group_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_household ON ai_insights (household_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_receipt_scans_household_month ON receipt_scans (household_id, created_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_receipts_household ON telegram_receipts (household_id, created_at);
CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_user ON telegram_link_codes (user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_user ON admin_audit_logs(admin_user_id);

-- ============================================================
-- Seed konfigurasi aplikasi
-- ============================================================
INSERT INTO app_settings (key, value, is_secret)
VALUES
  ('mailketing', '{"enabled": false, "api_token": "", "from_email": "", "from_name": "Finepro"}', true),
  ('midtrans', '{"enabled": false, "is_production": false, "server_key": "", "client_key": ""}', true),
  ('manual_payment', '{"enabled": false, "bank_name": "", "account_number": "", "account_name": "", "instructions": ""}', false),
  ('ai', '{"enabled": false, "provider": "sumopod", "sumopod_api_key": "", "sumopod_base_url": "https://ai.sumopod.com/v1", "sumopod_model": "gpt-4o-mini", "anthropic_api_key": "", "anthropic_model": "claude-sonnet-4-5", "insights_daily_limit": 3, "receipt_scan_monthly_limit": 30}', true),
  ('web_push', '{"enabled": true, "vapid_public_key": "", "vapid_private_key": "", "vapid_subject": "mailto:admin@finepro.my.id"}', true),
  ('telegram', '{"enabled": false, "bot_token": "", "bot_username": "", "n8n_shared_secret": ""}', true)
ON CONFLICT (key) DO NOTHING;
