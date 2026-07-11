-- ============================================================
-- Migrasi: AI Financial Insight (Fase 8)
-- Menyimpan snapshot statistik + narasi AI setiap kali tombol
-- "Analisa Keuangan" dipicu, dipakai juga untuk rate limiting
-- (maks N kali per hari per household, lihat api/routes/ai-insights.js).
-- Target: PostgreSQL standalone (lihat supabase/schema-pg.sql)
-- Jalankan manual: psql -U keuangan_app -d keuangan -f supabase/migrations/012_ai_insights.sql
-- ============================================================

create table if not exists ai_insights (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade not null,
  generated_at timestamptz default now(),
  stats_snapshot jsonb not null,
  narrative_text text not null
);

create index if not exists idx_ai_insights_household on ai_insights (household_id, generated_at desc);
