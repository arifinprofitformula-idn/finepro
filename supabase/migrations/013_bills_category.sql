-- ============================================================
-- Migrasi: Kategori opsional untuk tagihan (Fase 6)
-- Tabel `bills` sudah dibuat di 007_bills.sql dengan due_date (DATE) —
-- dipertahankan (bukan due_day integer) karena due_date sudah mendukung
-- tagihan berulang (is_recurring, dimajukan +1 bulan saat lunas di
-- api/routes/bills.js) maupun tagihan sekali-bayar dengan tanggal pasti,
-- superset dari due_day 1-31. Migrasi ini hanya menambah kolom category.
-- Target: PostgreSQL standalone (lihat supabase/schema-pg.sql)
-- Jalankan manual: psql -U keuangan_app -d keuangan -f supabase/migrations/013_bills_category.sql
-- ============================================================

alter table bills
  add column if not exists category text;
