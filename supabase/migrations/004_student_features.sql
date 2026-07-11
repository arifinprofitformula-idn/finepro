-- ============================================================
-- Migrasi: Fitur khusus household bertipe mahasiswa (student)
-- Target: PostgreSQL standalone (lihat supabase/schema-pg.sql) — bukan
-- RLS/auth.uid() Supabase, otorisasi ditangani di api/routes/households.js.
-- Jalankan manual: psql -U keuangan_app -d keuangan -f supabase/migrations/004_student_features.sql
-- ============================================================

alter table households
  add column if not exists monthly_income_day integer
  check (monthly_income_day is null or (monthly_income_day between 1 and 31));
