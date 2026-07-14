-- ============================================================
-- Migrasi: integrasi WhatsApp (link akun + auto-catat transaksi dari
-- foto struk/bukti transfer lewat WhatsApp Cloud API).
-- Target: PostgreSQL standalone
-- Jalankan: psql -U keuangan_app -d keuangan -f supabase/migrations/031_whatsapp_integration.sql
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_id VARCHAR(20) UNIQUE;

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_source_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_source_check
  CHECK (source IN ('manual', 'receipt_scan', 'telegram', 'whatsapp'));

-- Kode sekali pakai untuk menghubungkan akun web ke akun WhatsApp
-- (user generate kode di web, kirim kode via WhatsApp ke bot,
-- bot memanggil POST /api/whatsapp/link/confirm untuk menuntaskan link-nya).
CREATE TABLE IF NOT EXISTS whatsapp_link_codes (
  code TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Log lengkap tiap foto yang diproses lewat WhatsApp bot.
CREATE TABLE IF NOT EXISTS whatsapp_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES users(id) NOT NULL,
  whatsapp_id VARCHAR(20) NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'receipt' CHECK (doc_type IN ('receipt', 'transfer')),
  image_path TEXT,
  raw_text TEXT,
  extracted JSONB,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_receipts_household ON whatsapp_receipts (household_id, created_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_link_codes_user ON whatsapp_link_codes (user_id);
