-- ============================================================
-- Migrasi: Metode pembayaran (Manual / Midtrans / Xendit)
-- Tambah kolom method + data klaim manual (bukti transfer, review admin)
-- ke tabel payments. Baris lama otomatis dianggap 'midtrans' via DEFAULT.
-- Jalankan manual: psql -U keuangan_app -d keuangan -f supabase/migrations/029_payment_methods.sql
-- ============================================================

alter table payments add column if not exists method text not null default 'midtrans'
  check (method in ('midtrans','xendit','manual'));

alter table payments add column if not exists proof_url text;
alter table payments add column if not exists reference text;
alter table payments add column if not exists note text;
alter table payments add column if not exists reviewed_by uuid references users(id);
alter table payments add column if not exists reviewed_at timestamptz;

alter table payments drop constraint if exists payments_status_check;
alter table payments add constraint payments_status_check
  check (status in ('pending','paid','failed','rejected'));

create index if not exists idx_payments_method_status on payments (method, status);
