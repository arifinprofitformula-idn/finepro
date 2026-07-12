-- Pastikan seed Mailketing kosong tidak mengalahkan konfigurasi dari environment.
-- Hanya menyentuh row default yang belum pernah disimpan dari Admin Console.

UPDATE app_settings
SET value = jsonb_set(value, '{from_name}', '"Finepro"', true)
WHERE key = 'mailketing'
  AND updated_by IS NULL
  AND COALESCE(value->>'api_token', '') = ''
  AND COALESCE(value->>'from_email', '') = ''
  AND COALESCE(value->>'from_name', '') = 'Admin Finepro';
