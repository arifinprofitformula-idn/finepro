// api/services/personalRulesEngine.js
// Sprint 2 — Intelligence Layer: Personal Rules Engine
//
// - Auto-create rules when user corrects the same merchant/category 3+ times
// - Apply personal rules BEFORE AI analysis (zero-cost, instant)
// - Rules are per-household, scored by usage_count + recency
// - Rule types: 'always_category', 'always_wallet', 'always_type'

import pool from '../db.js';

// ── Constants ──────────────────────────────────────────────────────
const CORRECTION_THRESHOLD = 3;     // 3 corrections = auto-rule
const MIN_RULE_CONFIDENCE  = 0.8;   // Rule fires only when confidence >= 0.8

// ── Create / Upsert Rule ──────────────────────────────────────────

/**
 * Record a correction that may create/update a user rule.
 * Called after user confirms a corrected draft.
 *
 * @param {string} householdId
 * @param {object} corrections - e.g. { merchant: 'Indomaret', previous_merchant: 'Indomart' }
 * @param {object} originalAnalysis - the original analysis result before corrections
 * @returns {object|null} - newly created/updated rule, or null if below threshold
 */
export async function recordCorrection(householdId, corrections, originalAnalysis) {
  const rules = [];

  // 1. Merchant rule: if merchant was corrected
  if (corrections.merchant && originalAnalysis.merchant && originalAnalysis.merchant !== corrections.merchant) {
    const rule = await upsertRule(householdId, 'merchant_correction',
      originalAnalysis.merchant,
      { merchant: corrections.merchant }
    );
    if (rule) rules.push(rule);
  }

  // 2. Category rule: if category was corrected
  if (corrections.category && originalAnalysis?.category && originalAnalysis.category !== corrections.category) {
    // For category, the pattern is the merchant (if available) or the detected text
    const pattern = originalAnalysis.merchant || originalAnalysis.description || 'unknown';
    const rule = await upsertRule(householdId, 'category_correction',
      pattern,
      { category: corrections.category }
    );
    if (rule) rules.push(rule);
  }

  // 3. Wallet rule: if source wallet was corrected
  if (corrections.source_wallet_name && originalAnalysis?.source_wallet_name &&
      originalAnalysis.source_wallet_name !== corrections.source_wallet_name) {
    const rule = await upsertRule(householdId, 'wallet_correction',
      `source:${originalAnalysis.description || originalAnalysis.merchant || 'unknown'}`,
      { source_wallet_name: corrections.source_wallet_name }
    );
    if (rule) rules.push(rule);
  }

  // 4. Type rule: if transaction_type was corrected
  if (corrections.transaction_type && originalAnalysis?.transaction_type &&
      originalAnalysis.transaction_type !== corrections.transaction_type) {
    const pattern = originalAnalysis.merchant || originalAnalysis.description || 'unknown';
    const rule = await upsertRule(householdId, 'type_correction',
      pattern,
      { transaction_type: corrections.transaction_type }
    );
    if (rule) rules.push(rule);
  }

  return rules.filter(Boolean);
}

async function upsertRule(householdId, ruleType, pattern, result) {
  const resultJson = JSON.stringify(result);

  // Check existing
  const existing = await pool.query(
    `SELECT id, confidence, usage_count
     FROM user_transaction_rules
     WHERE household_id = $1 AND rule_type = $2 AND pattern = $3 AND result::text = $4`,
    [householdId, ruleType, pattern, resultJson]
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    const usageCount = row.usage_count + 1;
    const confidence = Math.min(1.0, Number(row.confidence) + 0.05);

    await pool.query(
      `UPDATE user_transaction_rules
       SET usage_count = $1, confidence = $2, last_used_at = now(), updated_at = now()
       WHERE id = $3`,
      [usageCount, confidence, row.id]
    );

    // Return only if over threshold
    if (usageCount >= CORRECTION_THRESHOLD) {
      return { id: row.id, rule_type: ruleType, pattern, result, usage_count: usageCount, confidence };
    }
    return null;
  }

  // New rule — start with count 1, low confidence
  await pool.query(
    `INSERT INTO user_transaction_rules (household_id, rule_type, pattern, result, confidence, usage_count)
     VALUES ($1, $2, $3, $4, 0.5, 1)`,
    [householdId, ruleType, pattern, resultJson]
  );

  // Not enough corrections yet — don't return as active rule
  if (1 < CORRECTION_THRESHOLD) return null;

  return { rule_type: ruleType, pattern, result, usage_count: 1, confidence: 0.5 };
}

// ── Query Rules ──────────────────────────────────────────────────

/**
 * Get ACTIVE rules (confidence >= 0.8) for a household.
 * Sorted by usage_count desc + recency.
 */
export async function getActiveRules(householdId) {
  const result = await pool.query(
    `SELECT rule_type, pattern, result, confidence, usage_count
     FROM user_transaction_rules
     WHERE household_id = $1
     AND confidence >= $2
     ORDER BY usage_count DESC, last_used_at DESC NULLS LAST
     LIMIT 30`,
    [householdId, MIN_RULE_CONFIDENCE]
  );
  return result.rows;
}

// ── Apply Rules ──────────────────────────────────────────────────

/**
 * Apply personal rules to pre-fill analysis.
 * Called BEFORE AI analysis — uses the rawAnalysis fields.
 *
 * Returns partial analysis with fields that rules can determine,
 * and boosts confidence for those fields.
 */
export function applyRules(ocrText, rules) {
  const result = {};
  Object.defineProperty(result, '_rule_match_count', { value: 0, writable: true, enumerable: false });
  Object.defineProperty(result, '_rules_applied', { value: [], writable: true, enumerable: false });
  Object.defineProperty(result, '_confidence_match', { value: 0, writable: true, enumerable: false });

  for (const rule of rules) {
    const ruleResult = typeof rule.result === 'string' ? JSON.parse(rule.result) : rule.result;

    switch (rule.rule_type) {
      case 'merchant_correction':
        // If OCR contains the misread name, auto-correct merchant
        if (ocrText.toLowerCase().includes(rule.pattern.toLowerCase())) {
          result.merchant = ruleResult.merchant;
          result._rules_applied.push(`merchant:${rule.pattern}→${ruleResult.merchant}`);
          result._confidence_match += 0.15;
        }
        break;

      case 'category_correction':
        if (ocrText.toLowerCase().includes(rule.pattern.toLowerCase())) {
          result.category = ruleResult.category;
          result._rules_applied.push(`category:${rule.pattern}→${ruleResult.category}`);
          result._confidence_match += 0.1;
        }
        break;

      case 'type_correction':
        if (ocrText.toLowerCase().includes(rule.pattern.toLowerCase())) {
          result.transaction_type = ruleResult.transaction_type;
          result._rules_applied.push(`type:${rule.pattern}→${ruleResult.transaction_type}`);
          result._confidence_match += 0.1;
        }
        break;

      case 'wallet_correction':
        if (rule.pattern.startsWith('source:') && ocrText.toLowerCase().includes(rule.pattern.slice(7).toLowerCase())) {
          result.source_wallet_name = ruleResult.source_wallet_name;
          result._rules_applied.push(`wallet:${rule.pattern}→${ruleResult.source_wallet_name}`);
          result._confidence_match += 0.1;
        }
        break;
    }
  }

  result._confidence_match = Math.min(0.4, result._confidence_match || 0);
  return result;
}

// ── Pre-check: can we bypass AI? ─────────────────────────────────

/**
 * If personal rules + merchant mapping can fully determine the transaction,
 * return the result without calling AI.
 *
 * Returns null if AI is still needed.
 */
export async function tryPersonalRulesBypass(householdId, ocrText) {
  const rules = await getActiveRules(householdId);
  const ruleHits = applyRules(ocrText, rules);

  // We need at least 2 rule hits + merchant + category to bypass AI
  if (ruleHits._rules_applied.length < 2) return null;
  if (!ruleHits.merchant || !ruleHits.category) return null;

  return {
    bypass: true,
    ...ruleHits,
    document_type: 'receipt',
    transaction_type: ruleHits.transaction_type || 'expense',
  };
}