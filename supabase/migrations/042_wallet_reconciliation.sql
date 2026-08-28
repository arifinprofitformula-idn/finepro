BEGIN;

CREATE TABLE IF NOT EXISTS wallet_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  wallet_id uuid NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES users(id),
  actual_balance numeric(18,2) NOT NULL CHECK (actual_balance >= 0),
  balance_before numeric(18,2) NOT NULL,
  adjustment_amount numeric(18,2) NOT NULL CHECK (adjustment_amount <> 0),
  reason text NOT NULL CHECK (reason IN ('missing_history', 'unknown_activity', 'opening_balance_error', 'other')),
  note text,
  idempotency_key uuid NOT NULL,
  reverses_id uuid REFERENCES wallet_reconciliations(id),
  reversed_by_id uuid REFERENCES wallet_reconciliations(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, idempotency_key),
  UNIQUE (reverses_id),
  UNIQUE (reversed_by_id)
);

CREATE INDEX IF NOT EXISTS idx_wallet_reconciliations_wallet_created
  ON wallet_reconciliations (wallet_id, created_at DESC);

COMMIT;
