-- Target tabungan dan aset (Rupiah, Emas, Perak)

CREATE TABLE IF NOT EXISTS savings_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  goal_type TEXT NOT NULL DEFAULT 'money'
    CHECK (goal_type IN ('money','gold','silver')),
  target_amount NUMERIC CHECK (target_amount IS NULL OR target_amount > 0),
  target_weight NUMERIC CHECK (target_weight IS NULL OR target_weight > 0),
  target_date DATE,
  wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','completed','archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS savings_goal_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID REFERENCES savings_goals(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount_paid NUMERIC NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  weight NUMERIC NOT NULL DEFAULT 0 CHECK (weight >= 0),
  price_per_unit NUMERIC CHECK (price_per_unit IS NULL OR price_per_unit >= 0),
  note TEXT,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_savings_goals_household_status
  ON savings_goals (household_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_savings_goal_contributions_goal_date
  ON savings_goal_contributions (goal_id, date DESC);
