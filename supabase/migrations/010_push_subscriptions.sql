-- ============================================================
-- Migrasi: Push subscription untuk notifikasi budget (Fase 5)
-- Target: PostgreSQL standalone (lihat supabase/schema-pg.sql)
-- Jalankan manual: psql -U keuangan_app -d keuangan -f supabase/migrations/010_push_subscriptions.sql
-- ============================================================

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

create index if not exists idx_push_subscriptions_user on push_subscriptions (user_id);
