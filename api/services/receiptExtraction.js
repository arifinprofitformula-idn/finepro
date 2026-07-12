// api/services/receiptExtraction.js
// Ekstraksi struk dua tahap, hemat token:
//   1. extractText()      — OCR lokal (Tesseract), gratis, jalan di VPS sendiri.
//   2. tryRegexExtraction() — coba baca TOTAL/GRAND TOTAL + tanggal pakai regex.
//      Kalau ketemu dengan pola jelas, LLM SAMA SEKALI TIDAK DIPANGGIL.
//   3. parseReceiptText() — baru kalau regex gagal/kurang yakin, teks OCR
//      (bukan gambar) dikirim ke LLM murah (default SumoPod gpt-4o-mini,
//      text-only; Anthropic tetap tersedia sebagai alternatif).
// parseReceiptText() sengaja pluggable lewat RECEIPT_PARSE_PROVIDER supaya
// provider text-parsing bisa diganti tanpa ubah kode pemanggil di routes/receipts.js.

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import tesseract from 'node-tesseract-ocr';
import { generateChatText } from './aiProvider.js';

const TESSERACT_CONFIG = {
  lang: process.env.TESSERACT_LANG || 'ind+eng',
  oem: 1,
  psm: 6,
  // Override opsional — dibutuhkan kalau tesseract/tessdata tidak ada di
  // lokasi default sistem (mis. dev di Windows tanpa hak admin ke Program
  // Files). Di VPS Ubuntu dengan `apt install tesseract-ocr tesseract-ocr-ind`
  // biasanya tidak perlu diisi sama sekali.
  ...(process.env.TESSERACT_BINARY_PATH ? { binary: process.env.TESSERACT_BINARY_PATH } : {}),
  ...(process.env.TESSDATA_DIR ? { 'tessdata-dir': process.env.TESSDATA_DIR } : {}),
};

export async function extractText(imageBuffer) {
  const tmpFile = path.join(os.tmpdir(), `receipt-${crypto.randomUUID()}.png`);
  await fs.writeFile(tmpFile, imageBuffer);
  try {
    const text = await tesseract.recognize(tmpFile, TESSERACT_CONFIG);
    return text.trim();
  } finally {
    await fs.unlink(tmpFile).catch(() => {});
  }
}

// "45.000" -> 45000, "45.000,50" -> 45000.5, "45000" -> 45000
function parseIndonesianNumber(str) {
  let s = str.trim();
  const decimalMatch = s.match(/,(\d{2})$/);
  let decimals = '';
  if (decimalMatch) {
    decimals = '.' + decimalMatch[1];
    s = s.slice(0, decimalMatch.index);
  }
  s = s.replace(/[.,]/g, '');
  return Number(s + decimals);
}

const DATE_PATTERNS = [
  { re: /\b(\d{4})-(\d{2})-(\d{2})\b/, fmt: (m) => `${m[1]}-${m[2]}-${m[3]}` },
  { re: /\b(\d{2})[\/\-](\d{2})[\/\-](\d{4})\b/, fmt: (m) => `${m[3]}-${m[2]}-${m[1]}` },
  { re: /\b(\d{2})[\/\-](\d{2})[\/\-](\d{2})\b/, fmt: (m) => `20${m[3]}-${m[2]}-${m[1]}` },
];

function findDate(rawText) {
  for (const { re, fmt } of DATE_PATTERNS) {
    const m = rawText.match(re);
    if (m) return fmt(m);
  }
  return null;
}

const TOTAL_LINE_RE = /(GRAND\s*TOTAL|TOTAL)\s*[:\-]?\s*(?:Rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\b/i;

function findTotal(rawText) {
  let totalMatch = null;
  let grandTotalMatch = null;

  for (const line of rawText.split('\n')) {
    if (/sub\s*-?\s*total/i.test(line)) continue; // "Subtotal" bukan total akhir
    const m = line.match(TOTAL_LINE_RE);
    if (!m) continue;
    if (/GRAND/i.test(m[1])) {
      grandTotalMatch = m;
      break; // GRAND TOTAL paling meyakinkan, langsung pakai
    }
    if (!totalMatch) totalMatch = m;
  }

  const match = grandTotalMatch || totalMatch;
  if (!match) return null;

  const amount = parseIndonesianNumber(match[2]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

// Fallback murah: kalau TOTAL/GRAND TOTAL dan tanggal sama-sama ketemu lewat
// regex, kita anggap confidence-nya tinggi dan skip panggilan LLM sepenuhnya.
export function tryRegexExtraction(rawText) {
  const amount = findTotal(rawText);
  const date = findDate(rawText);
  if (amount == null || !date) return null;

  const note = (rawText.split('\n').find((l) => l.trim().length > 3) || '').trim().slice(0, 80);
  // Regex cuma cocok untuk pola TOTAL/GRAND TOTAL struk belanja — bukti
  // transfer masuk nyaris tidak pernah match pola ini, jadi aman diasumsikan
  // expense/receipt di jalur ini (transfer akan jatuh ke fallback LLM).
  return { date, amount, suggested_category: '', note, type: 'expense', document_type: 'receipt', source: 'regex' };
}

function receiptPrompt(rawText) {
  return 'Ini hasil OCR dari foto struk belanja ATAU bukti transfer bank/e-wallet ' +
    '(mungkin ada noise/typo dari OCR):\n\n"""\n' +
    rawText +
    '\n"""\n\nEkstrak informasinya dan balas HANYA dengan JSON valid (tanpa markdown/teks lain) ' +
    'persis format ini: {"date":"YYYY-MM-DD","amount":<angka nominal tanpa titik/koma>,' +
    '"suggested_category":"<kategori singkat dalam Bahasa Indonesia, mis. Rumah Tangga/Kebutuhan Pokok/Transportasi/Transfer Masuk>",' +
    '"note":"<nama toko/warung/pengirim kalau ada>",' +
    '"type":"<\\"expense\\" kalau struk belanja/pembayaran keluar, \\"income\\" kalau bukti transfer/dana masuk>",' +
    '"document_type":"<\\"receipt\\" untuk struk belanja, \\"transfer\\" untuk bukti transfer/mutasi masuk>"}. ' +
    'Kalau tanggal tidak terbaca, pakai null. Kalau nominal tidak terbaca, pakai 0.';
}

function fallbackConfig(providerName) {
  const provider = providerName === 'claude-haiku' ? 'anthropic' : providerName;
  return {
    enabled: true,
    provider,
    sumopod_api_key: process.env.SUMOPOD_API_KEY || '',
    sumopod_base_url: process.env.SUMOPOD_BASE_URL || 'https://ai.sumopod.com/v1',
    sumopod_model: process.env.SUMOPOD_RECEIPT_MODEL || process.env.SUMOPOD_MODEL || 'gpt-4o-mini',
    anthropic_api_key: process.env.ANTHROPIC_API_KEY || '',
    anthropic_model: process.env.ANTHROPIC_HAIKU_MODEL || process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
  };
}

async function parseWithAiProvider(rawText, options = {}) {
  const providerName = options.provider || process.env.RECEIPT_PARSE_PROVIDER || 'sumopod';
  const config = {
    ...fallbackConfig(providerName),
    ...(options.aiConfig || {}),
    provider: providerName === 'claude-haiku' ? 'anthropic' : (options.aiConfig?.provider || providerName),
  };

  const text = await generateChatText({
    config,
    maxTokens: 300,
    temperature: 0.1,
    sumopodModel: options.sumopodModel || process.env.SUMOPOD_RECEIPT_MODEL || config.sumopod_model,
    anthropicModel: options.anthropicModel || process.env.ANTHROPIC_HAIKU_MODEL || config.anthropic_model,
    messages: [{
      role: 'user',
      content: receiptPrompt(rawText),
    }],
  });

  const raw = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(raw);
}

// Provider registry — nambah provider baru (mis. model lokal, provider lain)
// cukup daftarkan fungsi di sini, kode pemanggil (routes/receipts.js) tidak
// perlu diubah sama sekali.
const PARSE_PROVIDERS = {
  sumopod: parseWithAiProvider,
  anthropic: parseWithAiProvider,
  'claude-haiku': parseWithAiProvider,
};

export async function parseReceiptText(rawText, options = {}) {
  const providerName = options.provider || process.env.RECEIPT_PARSE_PROVIDER || 'sumopod';
  const provider = PARSE_PROVIDERS[providerName];
  if (!provider) {
    throw new Error(`Provider parsing struk tidak dikenal: ${providerName}`);
  }
  return provider(rawText, options);
}
