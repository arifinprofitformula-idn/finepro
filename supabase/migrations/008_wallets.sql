-- ============================================================
-- Migrasi: Multi-dompet & transfer antar dompet (Fase 4)
-- Target: PostgreSQL standalone (lihat supabase/schema-pg.sql)
-- Jalankan manual: psql -U keuangan_app -d keuangan -f supabase/migrations/008_wallets.sql
-- ============================================================

create table if not exists wallets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade not null,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists idx_wallets_household on wallets (household_id);

-- Transaksi income/expense sekarang bisa terhubung ke wallet spesifik.
-- Nullable supaya tidak ada transaksi lama yang gagal (dibackfill di bawah,
-- tapi tetap nullable untuk jaga-jaga & supaya insert lama tanpa wallet_id
-- tidak pernah error kalau ada jalur lain yang belum di-update).
alter table transactions
  add column if not exists wallet_id uuid references wallets(id);

create index if not exists idx_transactions_wallet on transactions (wallet_id);

-- Transfer TERPISAH dari transactions — tidak memengaruhi total income/expense,
-- cuma memindahkan saldo antar wallet dalam household yang sama.
create table if not exists wallet_transfers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade not null,
  from_wallet_id uuid references wallets(id) not null,
  to_wallet_id uuid references wallets(id) not null,
  amount numeric not null check (amount > 0),
  note text,
  created_by uuid references users(id) not null,
  created_at timestamptz default now(),
  check (from_wallet_id <> to_wallet_id)
);

create index if not exists idx_wallet_transfers_household on wallet_transfers (household_id);

-- Backfill: household yang sudah ada dapat 1 wallet default "Tunai",
-- transaksi lama tanpa wallet_id diarahkan ke situ.
do $$
declare
  h record;
  new_wallet_id uuid;
begin
  for h in select id from households loop
    if not exists (select 1 from wallets where household_id = h.id) then
      insert into wallets (household_id, name, is_default)
      values (h.id, 'Tunai', true)
      returning id into new_wallet_id;

      update transactions set wallet_id = new_wallet_id
      where household_id = h.id and wallet_id is null;
    end if;
  end loop;
end $$;

-- Extend trigger household baru: sekarang juga bikin 1 wallet default.
create or replace function handle_new_household()
returns trigger as $$
declare
  default_wallet_id uuid;
begin
  insert into household_members (household_id, user_id, role)
  values (new.id, new.owner_id, 'owner');

  insert into subscriptions (household_id, plan, status, current_period_end)
  values (new.id, 'trial', 'active', current_date + interval '14 days');

  perform seed_default_categories(new.id, new.household_type);

  insert into wallets (household_id, name, is_default)
  values (new.id, 'Tunai', true)
  returning id into default_wallet_id;

  return new;
end;
$$ language plpgsql;
