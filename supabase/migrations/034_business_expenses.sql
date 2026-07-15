-- Biaya operasional bisnis FinePro untuk laporan profit/loss owner.

CREATE TABLE IF NOT EXISTS business_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Operasional',
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_expenses_date ON business_expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_business_expenses_category ON business_expenses(category);
