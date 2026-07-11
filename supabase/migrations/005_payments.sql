-- ============================================================
-- Migrasi: Pembayaran & otomasi langganan (Midtrans Snap)
-- Target: PostgreSQL standalone (lihat supabase/schema-pg.sql) — otorisasi
-- & verifikasi signature webhook ditangani di api/routes/payments.js.
-- Jalankan manual: psql -U keuangan_app -d keuangan -f supabase/migrations/005_payments.sql
-- ============================================================

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade not null,
  order_id text unique not null,
  plan text not null check (plan in ('monthly','semiannual','annual')),
  amount numeric not null,
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  created_at timestamptz default now(),
  paid_at timestamptz
);

create index if not exists idx_payments_order_id on payments (order_id);
create index if not exists idx_payments_household on payments (household_id);
