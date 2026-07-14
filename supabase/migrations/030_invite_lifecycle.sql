-- ============================================================
-- Migrasi: Lifecycle undangan household
-- Tambah status cancelled agar owner bisa membatalkan undangan pending
-- tanpa menghapus riwayat undangan.
-- ============================================================

alter table household_invites drop constraint if exists household_invites_status_check;
alter table household_invites add constraint household_invites_status_check
  check (status in ('pending','accepted','expired','cancelled'));
