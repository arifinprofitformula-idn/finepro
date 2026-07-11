-- ============================================================
-- Migrasi: Arisan & Iuran (Fase 5)
-- Peserta arisan sering BUKAN user terdaftar di app (tetangga/teman),
-- jadi peserta disimpan sebagai teks bebas, bukan relasi ke tabel users.
-- Target: PostgreSQL standalone (lihat supabase/schema-pg.sql)
-- Jalankan manual: psql -U keuangan_app -d keuangan -f supabase/migrations/009_arisan.sql
-- ============================================================

create table if not exists arisan_groups (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade not null,
  name text not null,
  amount_per_period numeric not null check (amount_per_period >= 0),
  frequency_label text not null default 'Bulanan',
  created_by uuid references users(id) not null,
  created_at timestamptz default now()
);

create table if not exists arisan_participants (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references arisan_groups(id) on delete cascade not null,
  participant_name text not null,
  turn_order int,
  created_at timestamptz default now()
);

create table if not exists arisan_payments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references arisan_groups(id) on delete cascade not null,
  participant_id uuid references arisan_participants(id) on delete cascade not null,
  period_label text not null,
  paid boolean not null default false,
  paid_date timestamptz,
  unique (participant_id, period_label)
);

create index if not exists idx_arisan_groups_household on arisan_groups (household_id);
create index if not exists idx_arisan_participants_group on arisan_participants (group_id);
create index if not exists idx_arisan_payments_group_period on arisan_payments (group_id, period_label);
