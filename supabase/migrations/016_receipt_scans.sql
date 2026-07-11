-- ============================================================
-- Migrasi: log pemanggilan scan struk (AI vision) untuk rate limiting
-- Setiap baris = satu kali panggilan ke Claude vision API yang BENAR-BENAR
-- terjadi (biaya API sudah timbul saat baris ini dicatat, terlepas hasil
-- ekstraksinya berhasil dibaca atau tidak) — dipakai menghitung kuota
-- 30 scan/household/bulan di GET/POST /api/receipts/*.
-- Target: PostgreSQL standalone (lihat supabase/schema-pg.sql)
-- Jalankan manual: psql -U keuangan_app -d keuangan -f supabase/migrations/016_receipt_scans.sql
-- ============================================================

create table if not exists receipt_scans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade not null,
  created_by uuid references users(id) not null,
  created_at timestamptz default now()
);

create index if not exists idx_receipt_scans_household_month on receipt_scans (household_id, created_at);
