-- ============================================================
-- Migrasi: system_key kategori untuk pos sistem yang butuh identitas stabil.
-- Tujuan utama: Zakat & Sedekah boleh di-rename oleh user, tapi backend tetap
-- bisa menghitungnya sebagai pos amal tanpa hardcode nama tampilannya.
-- Target: PostgreSQL standalone
-- Jalankan manual: psql -U keuangan_app -d keuangan -f supabase/migrations/021_category_system_keys.sql
-- ============================================================

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS system_key TEXT;

UPDATE categories
SET system_key = 'zakat_sedekah'
WHERE type = 'expense'
  AND system_key IS NULL
  AND name IN ('Zakat & Sedekah', 'Ibadah & Sedekah');

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_household_system_key
  ON categories (household_id, system_key)
  WHERE system_key IS NOT NULL;

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

  ELSE -- individual
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
