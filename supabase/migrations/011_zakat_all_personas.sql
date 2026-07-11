-- ============================================================
-- Migrasi: kategori "Ibadah & Sedekah" untuk SEMUA tipe household
-- (sebelumnya cuma di-seed untuk household_type = 'family')
-- ============================================================

-- 1. Backfill: tambahkan kategori ke household student/individual yang belum punya
INSERT INTO categories (household_id, type, name, is_default, sort_order)
SELECT h.id, 'expense', 'Ibadah & Sedekah', true,
  (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories c WHERE c.household_id = h.id AND c.type = 'expense')
FROM households h
WHERE h.household_type IN ('student', 'individual')
  AND NOT EXISTS (
    SELECT 1 FROM categories c
    WHERE c.household_id = h.id AND c.type = 'expense' AND c.name = 'Ibadah & Sedekah'
  );

-- 2. Update fungsi seed supaya household baru (student/individual) ikut dapat kategori ini
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
      (p_household_id, 'expense', 'Ibadah & Sedekah', true, 8),
      (p_household_id, 'expense', 'Lainnya', true, 9),
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
      (p_household_id, 'expense', 'Ibadah & Sedekah', true, 6),
      (p_household_id, 'expense', 'Lainnya', true, 7),
      (p_household_id, 'income', 'Gaji/Usaha', true, 1),
      (p_household_id, 'income', 'Lainnya', true, 2);
  END IF;
END;
$$ LANGUAGE plpgsql;
