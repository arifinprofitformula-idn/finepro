-- Proteksi undangan: penerima yang sudah tergabung di household lain
-- tidak boleh melihat/menerima undangan sebagai actionable.

ALTER TABLE household_invites
  ADD COLUMN IF NOT EXISTS status_reason TEXT;

ALTER TABLE household_invites DROP CONSTRAINT IF EXISTS household_invites_status_check;
ALTER TABLE household_invites ADD CONSTRAINT household_invites_status_check
  CHECK (status IN ('pending','accepted','expired','cancelled','blocked'));

UPDATE household_invites i
SET status = 'blocked',
    status_reason = 'Pengguna sudah terdaftar di household lain, sehingga undangan tidak dapat diterima.'
WHERE i.status = 'pending'
  AND EXISTS (
    SELECT 1
    FROM users u
    JOIN household_members hm ON hm.user_id = u.id
    WHERE lower(u.email) = lower(i.invited_email)
  );
