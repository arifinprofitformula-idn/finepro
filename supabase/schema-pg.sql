-- ============================================================
-- Skema Database Keuangan Keluarga — PostgreSQL Standalone
-- Adaptasi dari schema.sql Supabase → PostgreSQL 16
-- ============================================================

-- 0. Tabel users (pengganti auth.users Supabase)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user','admin','super_admin')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 1. Tabel keluarga/workspace
CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Keluarga Saya',
  owner_id UUID REFERENCES users(id) NOT NULL,
  household_type TEXT NOT NULL DEFAULT 'family'
    CHECK (household_type IN ('family','student','individual')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Anggota household
CREATE TABLE IF NOT EXISTS household_members (
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'owner' | 'member'
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (household_id, user_id)
);

-- 3. Transaksi keuangan
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES users(id) NOT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Budget per kategori
CREATE TABLE IF NOT EXISTS budgets (
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (household_id, category)
);

-- 5. Status langganan
CREATE TABLE IF NOT EXISTS subscriptions (
  household_id UUID REFERENCES households(id) ON DELETE CASCADE PRIMARY KEY,
  plan TEXT NOT NULL DEFAULT 'trial',
  status TEXT NOT NULL DEFAULT 'active',
  current_period_end DATE,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Kategori — dinamis per household
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (household_id, type, name)
);

-- ============================================================
-- Fungsi & Trigger
-- ============================================================

-- Seed kategori default sesuai tipe household
CREATE OR REPLACE FUNCTION seed_default_categories(p_household_id UUID, p_type TEXT)
RETURNS void AS $$
BEGIN
  IF p_type = 'family' THEN
    INSERT INTO categories (household_id, type, name, is_default, sort_order) VALUES
      (p_household_id, 'expense', 'Rumah Tangga', true, 1),
      (p_household_id, 'expense', 'Cicilan/Utang', true, 2),
      (p_household_id, 'expense', 'Pendidikan Anak', true, 3),
      (p_household_id, 'expense', 'Transportasi', true, 4),
      (p_household_id, 'expense', 'Kesehatan', true, 5),
      (p_household_id, 'expense', 'Tabungan & Investasi', true, 6),
      (p_household_id, 'expense', 'Ibadah & Sedekah', true, 7),
      (p_household_id, 'expense', 'Hiburan', true, 8),
      (p_household_id, 'expense', 'Lainnya', true, 9),
      (p_household_id, 'income', 'Gaji/Usaha', true, 1),
      (p_household_id, 'income', 'Coaching & Mentoring', true, 2),
      (p_household_id, 'income', 'Produk Digital', true, 3),
      (p_household_id, 'income', 'Investasi', true, 4),
      (p_household_id, 'income', 'Lainnya', true, 5);

  ELSIF p_type = 'student' THEN
    INSERT INTO categories (household_id, type, name, is_default, sort_order) VALUES
      (p_household_id, 'expense', 'Kos/Kontrakan', true, 1),
      (p_household_id, 'expense', 'Uang Makan', true, 2),
      (p_household_id, 'expense', 'Transportasi (Ojol/Motor)', true, 3),
      (p_household_id, 'expense', 'Buku & Alat Kuliah', true, 4),
      (p_household_id, 'expense', 'Kuota & Internet', true, 5),
      (p_household_id, 'expense', 'Nongkrong & Hiburan', true, 6),
      (p_household_id, 'expense', 'Tabungan', true, 7),
      (p_household_id, 'expense', 'Lainnya', true, 8),
      (p_household_id, 'income', 'Uang Kiriman Ortu', true, 1),
      (p_household_id, 'income', 'Beasiswa', true, 2),
      (p_household_id, 'income', 'Kerja Part-time/Freelance', true, 3),
      (p_household_id, 'income', 'Lainnya', true, 4);

  ELSE -- individual
    INSERT INTO categories (household_id, type, name, is_default, sort_order) VALUES
      (p_household_id, 'expense', 'Kebutuhan Pokok', true, 1),
      (p_household_id, 'expense', 'Transportasi', true, 2),
      (p_household_id, 'expense', 'Kesehatan', true, 3),
      (p_household_id, 'expense', 'Tabungan & Investasi', true, 4),
      (p_household_id, 'expense', 'Hiburan', true, 5),
      (p_household_id, 'expense', 'Lainnya', true, 6),
      (p_household_id, 'income', 'Gaji/Usaha', true, 1),
      (p_household_id, 'income', 'Lainnya', true, 2);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger: saat household baru dibuat → auto anggota owner + trial 14 hari + seed kategori
CREATE OR REPLACE FUNCTION handle_new_household()
RETURNS trigger AS $$
BEGIN
  INSERT INTO household_members (household_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');

  INSERT INTO subscriptions (household_id, plan, status, current_period_end)
  VALUES (NEW.id, 'trial', 'active', CURRENT_DATE + INTERVAL '14 days');

  PERFORM seed_default_categories(NEW.id, NEW.household_type);

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
CREATE INDEX IF NOT EXISTS idx_transactions_household_date ON transactions(household_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(household_id, type);
CREATE INDEX IF NOT EXISTS idx_household_members_user ON household_members(user_id);

-- 7. Konfigurasi aplikasi global untuk admin panel
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

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_user ON admin_audit_logs(admin_user_id);
