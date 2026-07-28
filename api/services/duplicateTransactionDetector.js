// api/services/duplicateTransactionDetector.js
// Transaction duplicate detection using fingerprint + image hash.

import crypto from 'crypto';
import pool from '../db.js';

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildTransactionFingerprint(analysis) {
  const parts = [
    analysis.amount || 0,
    analysis.transaction_date || '',
    normalizeText(analysis.merchant || ''),
    analysis.reference_number || '',
    analysis.source_wallet_id || '',
    analysis.destination_wallet_id || '',
  ];
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

export function computeImageHash(imageBuffer) {
  return crypto.createHash('sha256').update(imageBuffer).digest('hex');
}

/**
 * Check for duplicates in both transaction_analysis_drafts and transactions table.
 * Returns { is_possible_duplicate, score, matched_id, matched_type }
 */
export async function checkDuplicate(householdId, analysis, imageHash, excludeDraftId = null) {
    const fingerprint = buildTransactionFingerprint(analysis);

    let excludeClause = '';
    const params = [householdId, fingerprint, imageHash];
    if (excludeDraftId) {
      excludeClause = 'AND id != $4';
      params.push(excludeDraftId);
    }

    const result = await pool.query(
      `SELECT id, transaction_fingerprint, image_hash, status, created_at
       FROM transaction_analysis_drafts
       WHERE household_id = $1
       AND (transaction_fingerprint = $2 OR image_hash = $3)
       AND status != 'cancelled'
       AND created_at > now() - interval '7 days'
       ${excludeClause}
       LIMIT 5`,
      params
    );

  // Check transactions table (recent 7 days)
  const txResult = await pool.query(
    `SELECT id, amount, date, note, category, wallet_id, created_at
     FROM transactions
     WHERE household_id = $1
     AND amount = $2
     AND date = $3
     AND created_at > now() - interval '7 days'
     LIMIT 5`,
    [householdId, analysis.amount, analysis.transaction_date]
  );

  let bestScore = 0;
  let bestMatch = null;
  let bestType = null;

  // Score draft matches
  for (const row of result.rows) {
    let score = 0;
    if (row.image_hash === imageHash) score += 45;
    if (row.transaction_fingerprint === fingerprint) score += 55;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = row;
      bestType = 'draft';
    }
  }

  // Score transaction matches
  for (const row of txResult.rows) {
    let score = 0;
    if (row.amount === analysis.amount) score += 25;
    if (row.date.toISOString().slice(0, 10) === analysis.transaction_date) score += 15;
    if (normalizeText(row.note || '').includes(normalizeText(analysis.merchant || ''))) score += 10;
    if (row.wallet_id === analysis.source_wallet_id) score += 10;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = row;
      bestType = 'transaction';
    }
  }

  return {
    is_possible_duplicate: bestScore >= 50,
    score: bestScore,
    matched_id: bestMatch?.id || null,
    matched_type: bestType,
  };
}
