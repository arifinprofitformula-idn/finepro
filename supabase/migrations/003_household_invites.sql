-- ============================================================
-- Migrasi: Undangan Anggota Household (kolaborasi persona "family")
-- Target: PostgreSQL standalone (lihat supabase/schema-pg.sql) — bukan
-- RLS/auth.uid() Supabase, otorisasi ditangani di api/routes/invites.js.
-- Jalankan manual: psql -U keuangan_app -d keuangan -f supabase/migrations/003_household_invites.sql
-- ============================================================

create table if not exists household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade not null,
  invited_email text not null,
  invited_by uuid references users(id) not null,
  status text not null default 'pending' check (status in ('pending','accepted','expired')),
  created_at timestamptz default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);

create index if not exists idx_household_invites_email on household_invites (lower(invited_email));
create index if not exists idx_household_invites_household on household_invites (household_id);
