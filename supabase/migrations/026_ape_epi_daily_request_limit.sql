-- Batas request harian integrasi eksternal, termasuk APE-EPI.

CREATE TABLE IF NOT EXISTS integration_request_logs (
  integration_key TEXT NOT NULL,
  request_date DATE NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  last_requested_at TIMESTAMPTZ,
  PRIMARY KEY (integration_key, request_date)
);

CREATE INDEX IF NOT EXISTS idx_integration_request_logs_date
  ON integration_request_logs (integration_key, request_date DESC);

UPDATE app_settings
SET value = value || '{"max_daily_requests": 3}'::jsonb
WHERE key = 'ape_epi'
  AND NOT (value ? 'max_daily_requests');
