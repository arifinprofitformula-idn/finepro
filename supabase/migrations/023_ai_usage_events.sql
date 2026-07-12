-- ============================================================
-- Migrasi: Usage event AI terpusat untuk monetisasi dan quota
-- Semua pemakaian fitur AI/scan dicatat di sini, baik dari web maupun
-- Telegram, supaya limit plan tidak bisa dilewati lewat channel lain.
-- Target: PostgreSQL standalone (lihat supabase/schema-pg.sql)
-- Jalankan manual: psql -U keuangan_app -d keuangan -f supabase/migrations/023_ai_usage_events.sql
-- ============================================================

create table if not exists ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade not null,
  user_id uuid references users(id) on delete set null,
  feature text not null check (feature in ('receipt_scan','ai_insight')),
  source text not null check (source in ('web','telegram')),
  used_ai boolean not null default false,
  provider text,
  model text,
  input_tokens integer,
  output_tokens integer,
  estimated_cost numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_ai_usage_household_feature_created
  on ai_usage_events (household_id, feature, created_at desc);

create index if not exists idx_ai_usage_source_created
  on ai_usage_events (source, created_at desc);

insert into app_settings (key, value, is_secret)
values (
  'ai_quota',
  '{"trial_insight_total": 3, "trial_scan_total": 5, "free_insight_monthly": 1, "free_scan_monthly": 3, "paid_insight_daily": 3, "paid_scan_monthly": 30}',
  false
)
on conflict (key) do nothing;
