-- ============================================================
-- Skema Database untuk PWA Keuangan Keluarga (Coach Arifin)
-- Jalankan di: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- 1. Tabel keluarga/workspace (agar bisa multi-user berbagi 1 data)
create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Keluarga Saya',
  owner_id uuid references auth.users(id) not null,
  created_at timestamptz default now()
);

-- 2. Anggota household (pemilik + yang diundang)
create table if not exists household_members (
  household_id uuid references households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'member', -- 'owner' | 'member'
  joined_at timestamptz default now(),
  primary key (household_id, user_id)
);

-- 3. Transaksi keuangan
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade not null,
  created_by uuid references auth.users(id) not null,
  date date not null,
  type text not null check (type in ('income','expense')),
  category text not null,
  amount numeric not null check (amount >= 0),
  note text,
  created_at timestamptz default now()
);

-- 4. Budget per kategori
create table if not exists budgets (
  household_id uuid references households(id) on delete cascade not null,
  category text not null,
  amount numeric not null default 0,
  updated_at timestamptz default now(),
  primary key (household_id, category)
);

-- 5. Status langganan (subscription) per household
create table if not exists subscriptions (
  household_id uuid references households(id) on delete cascade primary key,
  plan text not null default 'trial', -- 'trial' | 'monthly' | 'semiannual' | 'annual'
  status text not null default 'active', -- 'active' | 'expired' | 'cancelled'
  current_period_end date,
  updated_at timestamptz default now()
);

-- ============================================================
-- Row Level Security (RLS) — kunci utama multi-tenant aman
-- ============================================================
alter table households enable row level security;
alter table household_members enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;
alter table subscriptions enable row level security;

-- Household: hanya anggota yang bisa lihat/edit household-nya
create policy "household select for members" on households
  for select using (
    id in (select household_id from household_members where user_id = auth.uid())
  );

create policy "household insert by owner" on households
  for insert with check (owner_id = auth.uid());

-- household_members: anggota bisa lihat daftar anggota di household yang sama
create policy "members select same household" on household_members
  for select using (
    household_id in (select household_id from household_members where user_id = auth.uid())
  );

create policy "members insert self" on household_members
  for insert with check (user_id = auth.uid());

-- Transactions: hanya anggota household terkait yang bisa CRUD
create policy "transactions select for members" on transactions
  for select using (
    household_id in (select household_id from household_members where user_id = auth.uid())
  );
create policy "transactions insert for members" on transactions
  for insert with check (
    household_id in (select household_id from household_members where user_id = auth.uid())
  );
create policy "transactions update for members" on transactions
  for update using (
    household_id in (select household_id from household_members where user_id = auth.uid())
  );
create policy "transactions delete for members" on transactions
  for delete using (
    household_id in (select household_id from household_members where user_id = auth.uid())
  );

-- Budgets: sama seperti transactions
create policy "budgets select for members" on budgets
  for select using (
    household_id in (select household_id from household_members where user_id = auth.uid())
  );
create policy "budgets upsert for members" on budgets
  for insert with check (
    household_id in (select household_id from household_members where user_id = auth.uid())
  );
create policy "budgets update for members" on budgets
  for update using (
    household_id in (select household_id from household_members where user_id = auth.uid())
  );

-- Subscriptions: anggota household bisa lihat status langganan sendiri
create policy "subscriptions select for members" on subscriptions
  for select using (
    household_id in (select household_id from household_members where user_id = auth.uid())
  );

-- ============================================================
-- Trigger: saat household baru dibuat, otomatis jadi anggota +
-- owner + trial 14 hari
-- ============================================================
create or replace function handle_new_household()
returns trigger as $$
begin
  insert into household_members (household_id, user_id, role)
  values (new.id, new.owner_id, 'owner');

  insert into subscriptions (household_id, plan, status, current_period_end)
  values (new.id, 'trial', 'active', current_date + interval '14 days');

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_household_created on households;
create trigger on_household_created
  after insert on households
  for each row execute function handle_new_household();
