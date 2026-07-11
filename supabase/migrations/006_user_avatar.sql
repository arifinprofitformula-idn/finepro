-- ============================================================
-- Migrasi: Foto profil user
-- Target: PostgreSQL standalone (lihat supabase/schema-pg.sql)
-- Jalankan manual: psql -U keuangan_app -d keuangan -f supabase/migrations/006_user_avatar.sql
-- ============================================================

alter table users
  add column if not exists avatar_url text;
