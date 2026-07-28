// api/services/feedbackLearning.js
// Sprint 2 — Feedback Learning Engine
//
// User corrects or ratifies analysis → system learns.
// All Sprint 2 intelligence layers converge here.
//
// Feed types:
//   - CORRECT: user confirms all fields were right → boost confidence
//   - CORRECTED: user made corrections → learn from corrections
//   - INCORRECT: user says it was wrong → negative feedback
//
// On FEEDBACK_CORRECTED:
//   1. Save to transaction_analysis_feedback table
//   2. Feed into personalRulesEngine.recordCorrection()
//   3. Feed into merchantMapping.learnMappingFromCorrection()
//   4. Feed into walletIdentifiers.registerWalletIdentifier()
//   5. Adjust confidence thresholds

import pool from '../db.js';
import { recordCorrection } from './personalRulesEngine.js';
import { learnMappingFromCorrection } from './merchantMapping.js';
import { registerWalletIdentifier } from './walletIdentifiers.js';

// ── Constants ──────────────────────────────────────────────────────

const FEEDBACK_TYPES = ['correct', 'corrected', 'incorrect'];

// ── Process Feedback ───────────────────────────────────────────────

/**
 * Process user feedback — the central feedback hub.
 *
 * @param {object} params
 * @param {string} params.householdId
 * @param {string} params.userId
 * @param {string} params.feedbackType - 'correct' | 'incorrect' | 'corrected'
 * @param {object} params.originalAnalysis — the full analysis object (from draft or transaction)
 * @param {object} params.correctedFields — fields that were corrected (only for 'corrected')
 * @param {string} params.channel — 'web' | 'telegram' | 'whatsapp'
 * @param {string} params.draftId — draft ID if feedback from draft
 * @param {string} params.transactionId — transaction ID if feedback from confirmed transaction
 * @param {string} params.ocrText — original OCR text (needed for wallet/merchant learning)
 */
export async function processFeedback({
  householdId,
  userId,
  feedbackType,
  originalAnalysis,
  correctedFields = {},
  channel = 'web',
  draftId = null,
  transactionId = null,
  ocrText = '',
}) {
  if (!FEEDBACK_TYPES.includes(feedbackType)) {
    throw new Error(`Invalid feedbackType: ${feedbackType}`);
  }

  // Save to feedback table
  await pool.query(
    `INSERT INTO transaction_analysis_feedback
     (household_id, user_id, transaction_id, draft_id, original_analysis, corrected_fields, source_channel)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [householdId, userId, transactionId, draftId,
     JSON.stringify(originalAnalysis),
     JSON.stringify(correctedFields),
     channel]
  );

  const results = {
    feedback_type: feedbackType,
    personal_rule: null,
    merchant_mapping: null,
    wallet_identifier: null,
    wallet_aggregate_boost: null,
  };

  if (feedbackType === 'correct') {
    // Correct: just boost merchant mapping confidence if available
    if (originalAnalysis?.merchant && originalAnalysis?.category) {
      results.merchant_mapping = await learnMappingFromCorrection(
        householdId,
        originalAnalysis.merchant,
        originalAnalysis.category,
        originalAnalysis?.subcategory,
        originalAnalysis.transaction_type || 'expense'
      );
    }

    // Boost wallet identifier confidence for this transaction's wallet
    if (originalAnalysis?.source_wallet_id && ocrText) {
      await registerWalletIdentifier(householdId, originalAnalysis.source_wallet_id, ocrText);
    }

    return results;
  }

  if (feedbackType === 'corrected') {
    // 1. PERSONAL RULES
    if (Object.keys(correctedFields).length > 0) {
      results.personal_rule = await recordCorrection(
        householdId,
        { ...correctedFields, ...(originalAnalysis?.merchant && { merchant: correctedFields.merchant || originalAnalysis.merchant }) },
        originalAnalysis
      );
    }

    // 2. MERCHANT MAPPING
    if (correctedFields.category || correctedFields.merchant) {
      const merchant = correctedFields.merchant || originalAnalysis?.merchant;
      const category = correctedFields.category || originalAnalysis?.category;
      if (merchant && category) {
        results.merchant_mapping = await learnMappingFromCorrection(
          householdId, merchant, category,
          correctedFields.subcategory || originalAnalysis?.subcategory,
          originalAnalysis?.transaction_type || 'expense'
        );
      }
    }

    // 3. WALLET IDENTIFIER
    if (originalAnalysis?.source_wallet_id && ocrText) {
      results.wallet_identifier = await registerWalletIdentifier(
        householdId, originalAnalysis.source_wallet_id, ocrText
      );
    }

    // 4. Update draft
    if (draftId) {
      const existing = await pool.query(
        'SELECT analysis FROM transaction_analysis_drafts WHERE id = $1',
        [draftId]
      );
      if (existing.rows.length > 0) {
        const updated = { ...existing.rows.analysis, ...correctedFields };
        await pool.query(
          'UPDATE transaction_analysis_drafts SET updated_at = now() WHERE id = $1',
          [draftId]
        );
      }
    }
  }

  if (feedbackType === 'incorrect') {
    // Negative feedback — reduce confidence
    // We don't auto-correct from negative feedback (too ambiguous)
    // Just log it
    results.negative = true;
    results.note = 'Negative feedback recorded — no auto-correction applied';
  }

  return results;
}

// ── Queries ────────────────────────────────────────────────────────

/**
 * Get feedback history for a household
 */
export async function getFeedbackHistory(householdId, limit = 50) {
  const result = await pool.query(
    `SELECT created_at, source_channel, original_analysis, corrected_fields
     FROM transaction_analysis_feedback
     WHERE household_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [householdId, limit]
  );
  return result.rows;
}