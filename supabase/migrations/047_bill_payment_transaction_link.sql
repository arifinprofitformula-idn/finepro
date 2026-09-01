-- Hubungkan pembayaran tagihan ke transaksi pengeluaran yang dibuat otomatis.
-- Ini menjaga klik "lunas" tetap idempotent per bill + due_date.

ALTER TABLE bill_payment_statements
  ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bill_payment_statements_transaction
  ON bill_payment_statements (transaction_id);
