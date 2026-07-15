-- Admin global + konfigurasi integrasi pihak ketiga.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin', 'super_admin'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_secret BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES users(id) NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_user ON admin_audit_logs(admin_user_id);

INSERT INTO app_settings (key, value, is_secret)
VALUES
  ('mailketing', '{"enabled": false, "api_token": "", "from_email": "", "from_name": "Finepro", "list_id": ""}', true),
  ('midtrans', '{"enabled": false, "is_production": false, "server_key": "", "client_key": ""}', true),
  ('manual_payment', '{"enabled": false, "bank_name": "", "account_number": "", "account_name": "", "instructions": ""}', false),
  ('ai', '{"enabled": false, "provider": "sumopod", "sumopod_api_key": "", "sumopod_base_url": "https://ai.sumopod.com/v1", "sumopod_model": "gpt-4o-mini", "anthropic_api_key": "", "anthropic_model": "claude-sonnet-4-5", "insights_daily_limit": 3, "receipt_scan_monthly_limit": 30}', true),
  ('web_push', '{"enabled": true, "vapid_public_key": "", "vapid_private_key": "", "vapid_subject": "mailto:admin@finepro.my.id"}', true)
ON CONFLICT (key) DO NOTHING;
