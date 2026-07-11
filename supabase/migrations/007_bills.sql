-- ============================================================
-- Migrasi: Tagihan & pengingat jatuh tempo (Fase 5)
-- Target: PostgreSQL standalone (lihat supabase/schema-pg.sql)
-- Jalankan manual: psql -U keuangan_app -d keuangan -f supabase/migrations/007_bills.sql
-- ============================================================

create table if not exists bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade not null,
  name text not null,
  amount numeric not null check (amount >= 0),
  due_date date not null,
  is_recurring boolean not null default false,
  paid_at timestamptz,
  created_by uuid references users(id) not null,
  created_at timestamptz default now()
);

create index if not exists idx_bills_household on bills (household_id);
create index if not exists idx_bills_due_date on bills (household_id, due_date);
