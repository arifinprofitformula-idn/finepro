BEGIN;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_method_check
  CHECK (method IN ('midtrans', 'xendit', 'sumopod', 'manual'));

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending', 'paid', 'failed', 'expired', 'rejected'));

ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_payment_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_link_url TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_payment_id
  ON payments (provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

INSERT INTO app_settings (key, value, is_secret)
VALUES (
  'sumopod_payment',
  '{"enabled":false,"api_key":"","webhook_token":"","base_url":"https://api-pay.sumopod.com"}'::jsonb,
  true
)
ON CONFLICT (key) DO NOTHING;

COMMIT;
