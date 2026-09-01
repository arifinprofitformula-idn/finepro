-- Progres cicilan dan guard pembayaran bulanan.
-- installment_total NULL berarti tagihan rutin tanpa batas tenor.
-- Index bill_id + period_month mempercepat validasi satu pembayaran per bulan.
-- Guard utama dilakukan backend dalam transaksi DB dengan SELECT ... FOR UPDATE.

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS installment_total INTEGER CHECK (installment_total IS NULL OR installment_total BETWEEN 1 AND 360);

CREATE INDEX IF NOT EXISTS idx_bill_payment_statements_bill_period
  ON bill_payment_statements (bill_id, period_month);
