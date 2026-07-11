-- ============================================================
-- Migrasi: Dukungan Multi-Persona (Keluarga / Mahasiswa / Individu)
-- Jalankan SETELAH supabase-schema.sql (Supabase SQL Editor > New Query)
-- ============================================================

-- 1. Tambah tipe household ke tabel yang sudah ada
alter table households
  add column if not exists household_type text not null default 'family'
  check (household_type in ('family','student','individual'));

-- 2. Tabel kategori — dinamis per household, bukan hardcode di JS
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade not null,
  type text not null check (type in ('income','expense')),
  name text not null,
  sort_order int default 0,
  is_default boolean default false,
  created_at timestamptz default now(),
  unique (household_id, type, name)
);

alter table categories enable row level security;

create policy "categories select for members" on categories
  for select using (
    household_id in (select household_id from household_members where user_id = auth.uid())
  );
create policy "categories insert for members" on categories
  for insert with check (
    household_id in (select household_id from household_members where user_id = auth.uid())
  );
create policy "categories delete for members" on categories
  for delete using (
    household_id in (select household_id from household_members where user_id = auth.uid())
    and is_default = false  -- kategori default tidak boleh dihapus, hanya kategori custom
  );

-- 3. Fungsi seed kategori otomatis sesuai household_type
create or replace function seed_default_categories(p_household_id uuid, p_type text)
returns void as $$
begin
  if p_type = 'family' then
    insert into categories (household_id, type, name, is_default, sort_order) values
      (p_household_id, 'expense', 'Rumah Tangga', true, 1),
      (p_household_id, 'expense', 'Cicilan/Utang', true, 2),
      (p_household_id, 'expense', 'Pendidikan Anak', true, 3),
      (p_household_id, 'expense', 'Transportasi', true, 4),
      (p_household_id, 'expense', 'Kesehatan', true, 5),
      (p_household_id, 'expense', 'Tabungan & Investasi', true, 6),
      (p_household_id, 'expense', 'Ibadah & Sedekah', true, 7),
      (p_household_id, 'expense', 'Hiburan', true, 8),
      (p_household_id, 'expense', 'Lainnya', true, 9),
      (p_household_id, 'income', 'Gaji/Usaha', true, 1),
      (p_household_id, 'income', 'Coaching & Mentoring', true, 2),
      (p_household_id, 'income', 'Produk Digital', true, 3),
      (p_household_id, 'income', 'Investasi', true, 4),
      (p_household_id, 'income', 'Lainnya', true, 5);

  elsif p_type = 'student' then
    insert into categories (household_id, type, name, is_default, sort_order) values
      (p_household_id, 'expense', 'Kos/Kontrakan', true, 1),
      (p_household_id, 'expense', 'Uang Makan', true, 2),
      (p_household_id, 'expense', 'Transportasi (Ojol/Motor)', true, 3),
      (p_household_id, 'expense', 'Buku & Alat Kuliah', true, 4),
      (p_household_id, 'expense', 'Kuota & Internet', true, 5),
      (p_household_id, 'expense', 'Nongkrong & Hiburan', true, 6),
      (p_household_id, 'expense', 'Tabungan', true, 7),
      (p_household_id, 'expense', 'Lainnya', true, 8),
      (p_household_id, 'income', 'Uang Kiriman Ortu', true, 1),
      (p_household_id, 'income', 'Beasiswa', true, 2),
      (p_household_id, 'income', 'Kerja Part-time/Freelance', true, 3),
      (p_household_id, 'income', 'Lainnya', true, 4);

  else -- individual
    insert into categories (household_id, type, name, is_default, sort_order) values
      (p_household_id, 'expense', 'Kebutuhan Pokok', true, 1),
      (p_household_id, 'expense', 'Transportasi', true, 2),
      (p_household_id, 'expense', 'Kesehatan', true, 3),
      (p_household_id, 'expense', 'Tabungan & Investasi', true, 4),
      (p_household_id, 'expense', 'Hiburan', true, 5),
      (p_household_id, 'expense', 'Lainnya', true, 6),
      (p_household_id, 'income', 'Gaji/Usaha', true, 1),
      (p_household_id, 'income', 'Lainnya', true, 2);
  end if;
end;
$$ language plpgsql security definer;

-- 4. Update trigger household agar otomatis seed kategori sesuai tipe
create or replace function handle_new_household()
returns trigger as $$
begin
  insert into household_members (household_id, user_id, role)
  values (new.id, new.owner_id, 'owner');

  insert into subscriptions (household_id, plan, status, current_period_end)
  values (new.id, 'trial', 'active', current_date + interval '14 days');

  perform seed_default_categories(new.id, new.household_type);

  return new;
end;
$$ language plpgsql security definer;

-- Trigger lama otomatis pakai fungsi versi baru di atas (nama fungsi sama)
