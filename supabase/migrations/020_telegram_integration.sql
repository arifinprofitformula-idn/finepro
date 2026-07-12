-- ============================================================
-- Migrasi: integrasi Telegram (link akun + auto-catat transaksi dari
-- foto struk/bukti transfer lewat n8n).
-- Target: PostgreSQL standalone (lihat supabase/schema-pg.sql)
-- Jalankan manual: psql -U keuangan_app -d keuangan -f supabase/migrations/020_telegram_integration.sql
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id BIGINT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username TEXT;

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
  CHECK (source IN ('manual', 'receipt_scan', 'telegram'));

-- Kode sekali pakai untuk menghubungkan akun web ke akun Telegram
-- (user generate kode di web, kirim /start <code> ke bot, n8n memanggil
-- POST /api/telegram/link/confirm untuk menuntaskan link-nya).
CREATE TABLE IF NOT EXISTS telegram_link_codes (
  code TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Log lengkap tiap foto yang diproses lewat bot Telegram — beda dari
-- receipt_scans (yang cuma counter kuota web) karena di sini juga
-- menyimpan file foto, teks OCR mentah, hasil ekstraksi, dan link ke
-- transaksi yang dibuat otomatis.
CREATE TABLE IF NOT EXISTS telegram_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES users(id) NOT NULL,
  telegram_id BIGINT NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'receipt' CHECK (doc_type IN ('receipt', 'transfer')),
  image_path TEXT,
  raw_text TEXT,
  extracted JSONB,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_receipts_household ON telegram_receipts (household_id, created_at);
CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_user ON telegram_link_codes (user_id);
