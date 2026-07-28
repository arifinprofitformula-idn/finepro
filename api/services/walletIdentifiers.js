// api/services/walletIdentifiers.js
// Sprint 2 — Wallet Identifiers Engine
//
// Smart wallet matching by:
// - Bank name in OCR (Mandiri, BCA, BRI, BNI, etc.)
// - Account last 4 digits (xxxx-1234)
// - E-wallet phone numbers
// - Transaction patterns per wallet
//
// Populates wallet_identifiers table from:
// 1. User explicitly sets wallet
// 2. Transaction history patterns
// 3. Bank/ewallet detection from transfer screenshots

import pool from '../db.js';

// ── Bank / E-wallet Identifier Database ───────────────────────────
const BANK_VARIANTS = [
  { bank: 'mandiri',     keywords: ['mandiri', 'bank mandiri', 'livin', 'mandiri online'] },
  { bank: 'bca',         keywords: ['bca', 'bank central asia', 'halo bca', 'm-bca', 'mybca', 'bca mobile'] },
  { bank: 'bni',         keywords: ['bni', 'bank negara indonesia', 'bni mobile'] },
  { bank: 'bri',         keywords: ['bri', 'bank rakyat indonesia', 'brizzi', 'brimo'] },
  { bank: 'bsi',         keywords: ['bsi', 'bank syariah indonesia', 'bsi mobile'] },
  { bank: 'cimb',        keywords: ['cimb', 'cimb niaga', 'octo clicks'] },
  { bank: 'permata',     keywords: ['permata', 'permatabank', 'permatame'] },
  { bank: 'danamon',     keywords: ['danamon', 'd bank'] },
  { bank: 'panin',       keywords: ['panin', 'bank panin'] },
  { bank: 'maybank',     keywords: ['maybank', 'm2u'] },
  { bank: 'commonwealth', keywords: ['commonwealth'] },
  { bank: 'uob',         keywords: ['uob'] },
];

const EWALLET_VARIANTS = [
  { ewallet: 'gopay',     keywords: ['gopay', 'gojek', 'go pay'] },
  { ewallet: 'ovo',       keywords: ['ovo', 'ovo cash'] },
  { ewallet: 'dana',      keywords: ['dana', 'dana id'] },
  { ewallet: 'shopeepay', keywords: ['shopeepay', 'shopee pay'] },
  { ewallet: 'linkaja',   keywords: ['linkaja', 'link aja'] },
  { ewallet: 'isaku',     keywords: ['isaku'] },
  { ewallet: 'sakuku',    keywords: ['sakuku'] },
  { ewallet: 'sprin',     keywords: ['sprin', 'sea sprin'] },
  { ewallet: 'flip',      keywords: ['flip', 'flip id'] },
  { ewallet: 'jago',      keywords: ['jago', 'bank jago', 'jago syariah'] },
  { ewallet: 'blu',       keywords: ['blu', 'blubank', 'blu bca'] },
  { ewallet: 'jenius',    keywords: ['jenius', 'buntep'] },
  { ewallet: 'neobank',   keywords: ['neobank', 'yayasan neobank', 'neo bank'] },
  { ewallet: 'seabank',   keywords: ['seabank', 'sea bank'] },
  { ewallet: 'ajatain',   keywords: ['ajatain'] },
];

// ── Identifier Type Detection ────────────────────────────────────

/**
 * Detect bank name or ewallet from OCR text.
 * Returns { name, type: 'bank'|'ewallet', confidence: 0.0-1.0 }
 */
export function detectWalletVendor(ocrText) {
  const text = ocrText.toLowerCase();

  // Check banks
  for (const vendor of BANK_VARIANTS) {
    for (const kw of vendor.keywords) {
      if (text.includes(kw)) {
        return { name: vendor.bank, type: 'bank', confidence: 0.85 };
      }
    }
  }

  // Check ewallets
  for (const vendor of EWALLET_VARIANTS) {
    for (const kw of vendor.keywords) {
      if (text.includes(kw)) {
        return { name: vendor.ewallet, type: 'ewallet', confidence: 0.85 };
      }
    }
  }

  return null;
}

// ── Account Last 4 Digits ─────────────────────────────────────────

/**
 * Extract account/phone last 4 digits from OCR text.
 * Returns { last4, type: 'bank'|'phone'|'unknown' }
 */
export function extractAccountLast4(ocrText) {
  // Pattern: "xxxx-xxxx-xxxx-1234", "****1234", "xx1234"
  const patterns = [
    /[x\*]{4,12}[\- ]?(\d{4})(?!\d)/gi,
    /nomor rekening[: ]*.*?(\d{4})(?!\d)/i,
    /NO. REK[: ]*.*?(\d{4})(?!\d)/gi,
    /(\d{10,16})/,  // Full account number — take last 4
  ];

  for (const pat of patterns) {
    const m = pat.exec(ocrText);
    if (m) {
      const digits = m[1].length >= 10 ? asli.slice(-4) : m[1];
      return { last4: digits, type: m[1].length >= 10 ? 'bank' : 'unknown' };
    }
  }

  return null;
}

/**
 * Extract phone/sender number for ewallet identification.
 */
export function extractPhoneLast4(ocrText) {
  // Find patterns like 08xx, +62
  const phoneMatch = ocrText.match(/(08\d{8,11}|\+?62\d{8,11})/);
  if (phoneMatch) {
    const phone = phoneMatch[1];
    return { last4: phone.slice(-4), phone, type: 'phone' };
  }
  return null;
}

// ── Match Wallet ──────────────────────────────────────────────────

/**
 * Match OCR-detected vendor + last4 to a user wallet.
 */
export async function matchWallet(householdId, ocrText) {
  const vendor = detectWalletVendor(ocrText);
  const last4Info = extractAccountLast4(ocrText) || extractPhoneLast4(ocrText);

  // Try matching by identifier first
  if (last4Info?.last4) {
    const match = await pool.query(
      `SELECT wi.wallet_id, w.name as wallet_name, wi.identifier_type, wi.confidence
       FROM wallet_identifiers wi
       JOIN wallets w ON w.id = wi.wallet_id AND w.household_id = $1
       WHERE wi.household_id = $1 AND wi.identifier_value LIKE $2
       ORDER BY wi.confidence DESC, wi.created_at DESC LIMIT 1`,
      [householdId, `%${last4Info.last4}%`]
    );
    if (match.rows.length > 0) {
      return { wallet_id: match.rows[0].wallet_id, wallet_name: match.rows[0].wallet_name, confidence: 0.9 };
    }
  }

  // 2. Try matching by vendor name across wallets
  if (vendor) {
    // Get all wallet identifiers for this household
    const ids = await pool.query(
      `SELECT wi.wallet_id, w.name as wallet_name, wi.identifier_value, wi.identifier_type, wi.confidence
       FROM wallet_identifiers wi
       JOIN wallets w ON w.id = wi.wallet_id AND w.household_id = $1
       WHERE wi.household_id = $1 AND (w.name ILIKE $2 OR wi.identifier_value ILIKE $2)
       ORDER BY wi.confidence DESC LIMIT 1`,
      [householdId, `%${vendor.name}%`]
    );
    if (ids.rows.length > 0) {
      return { wallet_id: ids.rows[0].wallet_id, wallet_name: ids.rows[0].wallet_name, confidence: 0.8 };
    }

    // 3. Try name-match across the wallet names directly
    const nameMatch = await pool.query(
      `SELECT id, name FROM wallets
       WHERE household_id = $1 AND LOWER(name) LIKE $2 LIMIT 1`,
      [householdId, `%${vendor.name}%`]
    );
    if (nameMatch.rows.length > 0) {
      return { wallet_id: nameMatch.rows[0].id, wallet_name: nameMatch.rows[0].name, confidence: 0.7 };
    }
  }

  return null; // No match found
}

// ── Wallet Identifier Management ──────────────────────────────────

/**
 * Register a wallet identifier for later matching.
 * Called when user confirms a draft with a wallet assignment.
 */
export async function registerWalletIdentifier(householdId, walletId, ocrText) {
  const vendor = detectWalletVendor(ocrText);
  const last4Info = extractAccountLast4(ocrText) || extractPhoneLast4(ocrText);

  const identifiers = [];

  // Register last4 if found
  if (last4Info?.last4) {
    identifiers.push({
      type: last4Info.type === 'phone' ? 'whatsapp_source' : 'account_last4',
      value: last4Info.last4,
      isNew: true,
    });
  }

  const created = [];
  for (const id of identifiers) {
    // Check if already exists
    const existing = await pool.query(
      `SELECT id FROM wallet_identifiers
       WHERE wallet_id = $1 AND identifier_type = $2 AND identifier_value = $3`,
      [walletId, id.type, id.value]
    );
    if (existing.rows.length === 0) {
      const source = 'from_transaction';
      const confidence = id.type === 'vendor' ? 0.6 : 0.7;
      await pool.query(
        `INSERT INTO wallet_identifiers (household_id, wallet_id, identifier_type, identifier_value, source, confidence)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [householdId, walletId, id.type, id.value, source, confidence]
      );
      created.push(id);
    }
  }

  return created.length > 0 ? created : null;
}

// ── Bootrap from Transaction History ──────────────────────────────

/**
 * Scan transaction history for wallet identifiers to seed.
 * Finds transfers where wallet_name is in the note and creates wallet_identifier rows.
 * Called once per household, or periodically.
 */
export async function bootstrapWalletIdentifiers(householdId) {
  // Find transactions where note contains common bank/ewallet patterns
  const tx = await pool.query(
    `SELECT t.id, t.note, t.wallet_id, w.name as wallet_name
     FROM transactions t
     JOIN wallets w ON w.id = t.wallet_id AND w.household_id = $1
     WHERE t.household_id = $1
     AND t.note IS NOT NULL AND t.note != ''
     AND NOT EXISTS (
        SELECT 1 FROM wallet_identifiers wi WHERE wi.wallet_id = t.wallet_id AND wi.wallet_id = w.id
     )
     ORDER BY t.created_at DESC LIMIT 100`,
    [householdId]
  );

  let created = 0;
  for (const t of tx.rows) {
    const last4Info = extractAccountLast4(t.note);
    if (last4Info?.last4) {
      const exists = await pool.query(
        `SELECT id FROM wallet_identifiers WHERE wallet_id = $1 AND identifier_type = 'account_last4' AND identifier_value = $2`,
        [(t.wallet_id, last4Info.last4)]
      );
      if (exists.rows.length === 0) {
        await pool.query(
          `INSERT INTO wallet_identifiers (household_id, wallet_id, identifier_type, identifier_value, confidence, source)
           VALUES ($1, $2, 'account_last4', $3, 0.7, 'history')`,
          [householdId, t.wallet_id, last4Info.last4]
        );
        created++;
      }
    }
  }

  return { scanned: tx.rows.length, created };
}