-- Sistem tracking terpusat: Meta Pixel/CAPI, GA4/Measurement Protocol,
-- consent management, dan first/last-touch UTM attribution.
-- Settings memakai pola app_settings (lihat 017_admin_integrations.sql) untuk
-- singleton config (key = 'tracking'), sedangkan delivery log dan attribution
-- butuh tabel dedicated karena punya index/unique constraint dan tumbuh per baris.

INSERT INTO app_settings (key, value, is_secret)
VALUES (
  'tracking',
  '{
    "meta_browser_enabled": false,
    "meta_server_enabled": false,
    "meta_pixel_id": "",
    "meta_access_token_encrypted": "",
    "meta_test_event_code_encrypted": "",
    "meta_graph_api_version": "v21.0",
    "ga4_browser_enabled": false,
    "ga4_server_enabled": false,
    "ga4_measurement_id": "",
    "ga4_api_secret_encrypted": "",
    "ga4_region": "global",
    "consent_banner_enabled": true,
    "consent_version": "1",
    "default_analytics_consent": "denied",
    "default_marketing_consent": "denied",
    "privacy_policy_url": "/privacy",
    "cookie_policy_url": "/privacy",
    "banner_title": "Kami menghargai privasi kamu",
    "banner_description": "FinePro menggunakan cookie untuk analitik dan iklan agar pengalaman kamu lebih baik. Kamu bisa memilih kategori cookie yang diizinkan.",
    "tracking_debug_enabled": false,
    "exclude_admin_routes": true,
    "exclude_authenticated_admins": true,
    "utm_retention_days": 180,
    "event_mapping_json": {},
    "last_meta_test_at": null,
    "last_meta_test_status": null,
    "last_meta_test_message": null,
    "last_ga4_test_at": null,
    "last_ga4_test_status": null,
    "last_ga4_test_message": null
  }'::jsonb,
  true
)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS tracking_event_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  internal_event_name TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('meta', 'ga4')),
  channel TEXT NOT NULL CHECK (channel IN ('browser', 'server')),
  provider_event_name TEXT NOT NULL,
  delivery_status TEXT NOT NULL CHECK (delivery_status IN ('success', 'failed', 'skipped', 'retrying')),
  response_code INTEGER,
  error_code TEXT,
  error_message_sanitized TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  environment TEXT NOT NULL DEFAULT 'production',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tracking_deliveries_event_id ON tracking_event_deliveries(event_id);
CREATE INDEX IF NOT EXISTS idx_tracking_deliveries_provider ON tracking_event_deliveries(provider);
CREATE INDEX IF NOT EXISTS idx_tracking_deliveries_status ON tracking_event_deliveries(delivery_status);
CREATE INDEX IF NOT EXISTS idx_tracking_deliveries_created_at ON tracking_event_deliveries(created_at DESC);

-- Mencegah server mengirim ulang event server-side yang sama (idempotency).
-- Hanya berlaku untuk delivery yang benar-benar server-side (channel = 'server') —
-- retry loop atau restart proses tidak akan mengirim ulang event bisnis yang sama.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tracking_deliveries_provider_channel_event
  ON tracking_event_deliveries(provider, channel, event_id);

CREATE TABLE IF NOT EXISTS acquisition_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  anonymous_id TEXT NOT NULL,
  first_utm_source TEXT,
  first_utm_medium TEXT,
  first_utm_campaign TEXT,
  first_utm_content TEXT,
  first_utm_term TEXT,
  first_landing_path TEXT,
  first_referrer TEXT,
  first_fbclid TEXT,
  first_gclid TEXT,
  first_captured_at TIMESTAMPTZ,
  last_utm_source TEXT,
  last_utm_medium TEXT,
  last_utm_campaign TEXT,
  last_utm_content TEXT,
  last_utm_term TEXT,
  last_landing_path TEXT,
  last_referrer TEXT,
  last_fbclid TEXT,
  last_gclid TEXT,
  last_captured_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_acquisition_attribution_anonymous_id ON acquisition_attribution(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_acquisition_attribution_user_id ON acquisition_attribution(user_id);
