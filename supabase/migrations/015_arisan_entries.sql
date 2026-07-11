-- ============================================================
-- Migrasi: ledger setoran & giliran menerima arisan
-- arisan_groups + arisan_participants + arisan_payments SUDAH ADA sejak
-- 009_arisan.sql (roster peserta + toggle lunas/belum per periode, cocok
-- untuk arisan dengan iuran seragam). Tabel BARU ini melengkapi, BUKAN
-- menggantikan, model itu: mencatat setiap setoran sebagai baris histori
-- dengan tanggal & nominal bebas (mis. bayar duluan/nyicil/telat beda
-- nominal), dan is_payout menandai baris yang merupakan giliran seseorang
-- MENERIMA pot arisan pada putaran itu — kemampuan yang belum ada
-- sebelumnya (turn_order di arisan_participants cuma urutan statis, bukan
-- penanda "sudah menerima").
-- Target: PostgreSQL standalone (lihat supabase/schema-pg.sql)
-- Jalankan manual: psql -U keuangan_app -d keuangan -f supabase/migrations/015_arisan_entries.sql
-- ============================================================

create table if not exists arisan_entries (
  id uuid primary key default gen_random_uuid(),
  arisan_group_id uuid references arisan_groups(id) on delete cascade not null,
  date date not null default current_date,
  member_name text not null,
  amount numeric not null check (amount >= 0),
  is_payout boolean not null default false,
  created_by uuid references users(id) not null,
  created_at timestamptz default now()
);

create index if not exists idx_arisan_entries_group_date on arisan_entries (arisan_group_id, date desc);
