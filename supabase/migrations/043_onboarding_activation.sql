BEGIN;

CREATE TABLE IF NOT EXISTS household_onboarding (
  household_id uuid PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
  activation_required boolean NOT NULL DEFAULT true,
  wallet_setup_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_onboarding_progress (
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  onboarding_version integer NOT NULL DEFAULT 1 CHECK (onboarding_version > 0),
  current_step text,
  dashboard_tour_completed_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, user_id)
);

-- Existing production households stay usable; mandatory activation starts only
-- for households created after this migration.
INSERT INTO household_onboarding (household_id, activation_required, wallet_setup_completed_at)
SELECT h.id, false,
       CASE WHEN EXISTS (SELECT 1 FROM wallets w WHERE w.household_id=h.id) THEN now() ELSE NULL END
FROM households h
ON CONFLICT (household_id) DO NOTHING;

ALTER TABLE wallet_reconciliations
  ADD COLUMN IF NOT EXISTS entry_type text NOT NULL DEFAULT 'calibration';

ALTER TABLE wallet_reconciliations
  DROP CONSTRAINT IF EXISTS wallet_reconciliations_adjustment_amount_check;
ALTER TABLE wallet_reconciliations
  DROP CONSTRAINT IF EXISTS wallet_reconciliations_entry_type_check;
ALTER TABLE wallet_reconciliations
  ADD CONSTRAINT wallet_reconciliations_entry_type_check
  CHECK (entry_type IN ('calibration','opening_balance','reversal'));
ALTER TABLE wallet_reconciliations
  ADD CONSTRAINT wallet_reconciliations_adjustment_valid_check
  CHECK (entry_type = 'opening_balance' OR adjustment_amount <> 0);

CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_opening_balance
  ON wallet_reconciliations(wallet_id)
  WHERE entry_type='opening_balance';

CREATE OR REPLACE FUNCTION public.handle_new_household()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO household_members (household_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');

  INSERT INTO subscriptions (household_id, plan, status, current_period_end)
  VALUES (NEW.id, 'trial', 'active', CURRENT_DATE + INTERVAL '14 days');

  INSERT INTO household_onboarding (household_id, activation_required)
  VALUES (NEW.id, true);

  INSERT INTO user_onboarding_progress (household_id, user_id, onboarding_version, current_step)
  VALUES (NEW.id, NEW.owner_id, 1, 'wallet_setup')
  ON CONFLICT (household_id, user_id) DO NOTHING;

  PERFORM seed_default_categories(NEW.id, NEW.household_type);
  RETURN NEW;
END;
$function$;

COMMIT;
