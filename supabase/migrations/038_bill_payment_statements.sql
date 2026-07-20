-- Riwayat statement pembayaran tagihan.
-- Dipakai agar tagihan berulang tetap menampilkan periode/bulan yang sudah lunas
-- meskipun due_date tagihan aktif maju ke periode berikutnya.

CREATE TABLE IF NOT EXISTS bill_payment_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID REFERENCES bills(id) ON DELETE CASCADE NOT NULL,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  due_date DATE NOT NULL,
  period_month DATE NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (bill_id, due_date)
);

CREATE INDEX IF NOT EXISTS idx_bill_payment_statements_bill
  ON bill_payment_statements (bill_id, due_date DESC);

CREATE INDEX IF NOT EXISTS idx_bill_payment_statements_household
  ON bill_payment_statements (household_id, paid_at DESC);
