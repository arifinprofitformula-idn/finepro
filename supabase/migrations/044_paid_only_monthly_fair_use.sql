BEGIN;

-- Household baru wajib memilih dan membayar paket. Existing trial tidak disentuh.
ALTER TABLE subscriptions ALTER COLUMN plan SET DEFAULT 'monthly';
ALTER TABLE subscriptions ALTER COLUMN status SET DEFAULT 'pending_payment';

CREATE OR REPLACE FUNCTION public.handle_new_household()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO household_members (household_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');

  INSERT INTO subscriptions (household_id, plan, status, current_period_end)
  VALUES (NEW.id, 'monthly', 'pending_payment', NULL);

  INSERT INTO household_onboarding (household_id, activation_required)
  VALUES (NEW.id, true);

  INSERT INTO user_onboarding_progress (household_id, user_id, onboarding_version, current_step)
  VALUES (NEW.id, NEW.owner_id, 1, 'wallet_setup')
  ON CONFLICT (household_id, user_id) DO NOTHING;

  PERFORM seed_default_categories(NEW.id, NEW.household_type);
  RETURN NEW;
END;
$function$;

-- Merge, jangan overwrite konfigurasi harga/promo lain.
INSERT INTO app_settings (key, value, is_secret)
VALUES (
  'pricing',
  '{"normal":{"monthly":35000}}'::jsonb,
  false
)
ON CONFLICT (key) DO UPDATE
SET value = jsonb_set(
      COALESCE(app_settings.value, '{}'::jsonb),
      '{normal,monthly}',
      '35000'::jsonb,
      true
    ),
    updated_at = now();

-- Compatibility/admin values. Recurring enforcement tetap memakai planPolicy.js.
INSERT INTO app_settings (key, value, is_secret)
VALUES (
  'ai_quota',
  '{"short_scan_monthly":200,"short_insight_daily":30,"short_telegram_daily":500,"short_whatsapp_daily":500,"annual_scan_monthly":200,"annual_insight_daily":30,"annual_telegram_daily":500,"annual_whatsapp_daily":500}'::jsonb,
  false
)
ON CONFLICT (key) DO UPDATE
SET value = COALESCE(app_settings.value, '{}'::jsonb) || EXCLUDED.value,
    updated_at = now();

COMMIT;
