// api/services/merchantMapping.js
// Sprint 2 — Merchant Category Mapping Engine
//
// Already seeded with 23 global mapping, now add:
// 1. Auto-learn from user's correct transaction history
// 2. Create new mappings from user corrections (global → household)
// 3. Score new matches by confidence before promoting to global
//
// Layered resolution:
//   1. Personal (household) mapping — highest priority
//   2. Global mapping — medium priority
//   3. Historical category analysis — lowest, asynchronous

import pool from '../db.js';

// ── Query All Mappings ────────────────────────────────────────────

/**
 * Get category mapping for a merchant, best-match.
 * Returns { category, subcategory, confidence, source } or null.
 */
export async function getMerchantMapping(householdId, merchantText, transactionType = 'expense') {
  if (!merchantText) return null;

  const norm = normalizeText(merchantText);
  if (!norm || norm.length < 2) return null;

  // Layer 1: Exact personal mapping (highest priority)
  const personal = await pool.query(
    `SELECT category, subcategory, confidence, 'personal' as source
     FROM merchant_category_mappings
     WHERE household_id = $1
     AND transaction_type = $2
     AND merchant_normalized ILIKE $3
     ORDER BY usage_count DESC, confidence DESC LIMIT 1`,
    [householdId, transactionType, `%${norm}%`]
  );
  if (personal.rows.length > 0) {
    const r = personal.rows[0];
    return { category: r.category, subcategory: r.subcategory, confidence: Number(r.confidence), source: r.source };
  }

  // Layer 2: global mapping (if no personal match)
  const global = await pool.query(
    `SELECT category, subcategory, confidence, 'global' as source
     FROM merchant_category_mappings
     WHERE household_id IS NULL
     AND transaction_type = $1
     AND $2 ILIKE '%' || merchant_normalized || '%'
     ORDER BY usage_count DESC, confidence DESC LIMIT 1`,
    [transactionType, norm]
  );
  if (global.rows.length > 0) {
    const r = global.rows[0];
    // Promote to personal mapping with lower confidence
    const insertResult = await pool.query(
      `INSERT INTO merchant_category_mappings (household_id, merchant_normalized, transaction_type, category, subcategory, confidence, usage_count)
       VALUES ($1, $2, $3, $4, $5, 0.6, 1)
       ON CONFLICT DO NOTHING`,
      [householdId, norm, transactionType, r.category, r.subcategory]
    );
    return { category: r.category, subcategory: r.subcategory, confidence: 0.6, source: 'global' };
  }

  return null;
}

// ── AUTO-LEARN FROM CORRECTIONS ────────────────────────────────────

/**
 * User confirmed a correction — learn the new merchant→category mapping.
 * Called from feedback loop.
 */
export async function learnMappingFromCorrection(householdId, merchant, category, subcategory, transactionType = 'expense') {
  if (!merchant || !category) return null;

  const norm = normalizeText(merchant);
  if (!norm || norm.length < 2) return null;

  // Check existing
  const existing = await pool.query(
    `SELECT id, usage_count, confidence FROM merchant_category_mappings
     WHERE household_id = $1 AND merchant_normalized = $2 AND transaction_type = $3 AND category = $4`,
    [householdId, norm, transactionType, category]
  );

  if (existing.rows.length > 0) {
    const r = existing.rows[0];
    const newCount = r.usage_count + 1;
    const newConfidence = Math.min(1.0, Number(r.confidence) + 0.1);

    await pool.query(
      `UPDATE merchant_category_mappings
       SET usage_count = $1, confidence = $2, updated_at = now()
       WHERE id = $3`,
      [newCount, newConfidence, r.id]
    );

    return { action: 'incremented', category, usage: newCount, confidence: newConfidence };
  }

  // Create new mapping
  await pool.query(
    `INSERT INTO merchant_category_mappings (household_id, merchant_normalized, transaction_type, category, subcategory, confidence, usage_count)
     VALUES ($1, $2, $3, $4, $5, 0.6, 1)`,
    [householdId, norm, transactionType, category, subcategory || null]
  );

  return { action: 'created', merchant: norm, category };
}

// ── AUTO-SUGGEST ──────────────────────────────────────────────────

/**
 * Suggest category for a merchant based on all available mappings.
 * Returns array [{ category, subcategory, confidence, source }] sorted by confidence desc.
 */
export async function suggestCategories(householdId, merchantText, transactionType = 'expense') {
  if (!merchantText) return [];

  const norm = normalizeText(merchantText);
  if (!norm) return [];

  const result = await pool.query(
    `SELECT category, subcategory, confidence,
       CASE WHEN household_id IS NOT NULL THEN 'personal' ELSE 'global' END as source
     FROM merchant_category_mappings
     WHERE transaction_type = $1
     AND (household_id = $2 OR household_id IS NULL)
     AND $3 ILIKE '%' || merchant_normalized || '%'
     ORDER BY household_id DESC NULLS LAST, confidence DESC, usage_count DESC
     LIMIT 5`,
    [transactionType, householdId, norm]
  );

  return result.rows.map(r => ({
    category: r.category,
    subcategory: r.subcategory,
    confidence: Number(r.confidence),
    source: r.source,
  }));
}

// ── Bulk Learn ─────────────────────────────────────────────────────

/**
 * Learn from user's transaction history — scan rows, create mappings.
 */
export async function learnFromHistory(householdId, limit = 500) {
  const tx = await pool.query(
    `SELECT t.merchant, t.category, COUNT(*) as cnt
     FROM transactions t
     WHERE t.household_id = $1 AND t.merchant IS NOT NULL AND t.merchant != ''
     AND t.category IS NOT NULL AND t.category != ''
     GROUP BY t.merchant, t.category
     ORDER BY cnt DESC LIMIT $2`,
    [householdId, limit]
  );

  let created = 0;
  for (const r of tx.rows) {
    const norm = normalizeText(r.merchant);
    const exists = await pool.query(
      `SELECT id FROM merchant_category_mappings
       WHERE (household_id = $1 OR household_id IS NULL)
       AND merchant_normalized = $2 AND category = $3`,
      [householdId, norm, r.category]
    );
    if (exists.rows.length === 0 && r.cnt > 2) {
      const conf = Math.min(1.0, 0.5 + (r.cnt * 0.05));
      await pool.query(
        `INSERT INTO merchant_category_mappings (household_id, merchant_normalized, transaction_type, category, confidence, usage_count)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [householdId, norm, 'expense', r.category, conf, r.cnt]
      );
      created++;
    }
  }

  return { scanned: tx.rows.length, created };
}

// ── Utils ─────────────────────────────────────────────────────────

function normalizeText(val) {
  return String(val || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' dan ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}