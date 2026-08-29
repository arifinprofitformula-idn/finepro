BEGIN;

-- Cabut seluruh trial lama tanpa menghapus akun, household, atau data keuangan.
UPDATE subscriptions
SET plan = 'monthly',
    status = 'pending_payment',
    current_period_end = NULL,
    updated_at = now()
WHERE plan = 'trial';

COMMIT;
