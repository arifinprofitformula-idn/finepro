// api/services/duplicateTransactionDetector.js
// Sprint 2 — Enhanced Duplicate Detection
//
// Cross-channel (WA + TG + Web) duplicate detection with:
// - Fingerprint matching (hash of amount + date + merchant)
// - Image hash matching (same photo submitted twice)
// - Fuzzy amount matching (+/- 10% tolerance)
// - Merchant fuzzy match (Levenshtein distance)
// - Configurable time window
// - Checks both drafts AND confirmed transactions

import pool from '../db.js';

import crypto from 'crypto';

// ── Constants ──────────────────────────────────────────────────────

const DEFAULT_TIME_WINDOW_HOURS = 48;  // Look 48h back by default
const AMOUNT_TOLERANCE = 0.10;         // 10% amount tolerance
const MAX_EDIT_DISTANCE = 3;           // Max Levenshtein for merchant fuzzy match

// ── Fingerprint ────────────────────────────────────────────────────

function buildTransactionFingerprint(analysis) {
  const parts = [
    String(analysis.transaction_type || ''),
    String(Math.round(Number(analysis.amount) || 0)),
    String(analysis.transaction_date || '').slice(0, 10),
    String(analysis.merchant || '').toLowerCase().trim().slice(0, 30),
    String(analysis.source_wallet_name || '').toLowerCase().trim().slice(0, 20),
  ];
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

// ── Levenshtein ────────────────────────────────────────────────────

function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array.from({ length: a.length + 1 }, () => []);
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

// ── Fuzzy Amount Match ─────────────────────────────────────────────

function fuzzyAmountMatch(a1, a2) {
  const n1 = Number(a1);
  const n2 = Number(a2);
  if (n1 <= 0 || n2 <= 0) return a1 === a2 ? 1 : 0;
  const ratio = Math.abs(n1 - n2) / Math.max(n1, n2);
  if (ratio === 0) return 1.0;
  if (ratio <= AMOUNT_TOLERANCE / 2) return 0.8;
  if (ratio <= AMOUNT_TOLERANCE) return 0.5;
  return 0;
}

// ── Fuzzy Merchant Match ──────────────────────────────────────────

function fuzzyMerchantMatch(m1, m2) {
  if (!m1 || !m2) return m1 === m2 ? 1 : 0;
  const a = m1.toLowerCase().trim();
  const b = m2.toLowerCase().trim();
  if (a === b) return 1.0;
  if (a.includes(b) || b.includes(a)) return 0.9;
  const dist = levenshtein(a, b);
  if (dist <= 1) return 0.85;
  if (dist <= MAX_EDIT_DISTANCE) return 0.6;
  return 0;
}

// ── Core Check ──────────────────────────────────────────────────────

/**
 * Enhanced duplicate check with fuzzy matching + cross-channel.
 *
 * @param {string} householdId
 * @param {object} analysis - extracted analysis result (amount, date, merchant, etc.)
 * @param {string} imageHash - SHA-256 of image buffer
 * @param {string|null} excludeDraftId - draft ID to exclude (avoid self-match)
 * @param {number} timeWindowHours - how far back to check (default 48h)
 * @returns {{ is_possible_duplicate, score, matched_id, match_type, existing_analysis }}
 */
export async function checkDuplicate(householdId, analysis, imageHash, excludeDraftId = null, timeWindowHours = DEFAULT_TIME_WINDOW_HOURS) {
  const fingerprint = buildTransactionFingerprint(analysis);

  // 1. Check drafts (pending + confirmed)
  const draftCheck = await pool.query(
    `SELECT id, transaction_fingerprint, image_hash, status, analysis, created_at
     FROM transaction_analysis_drafts
     WHERE household_id = $1
     AND id != $2
     AND status IN ('pending', 'confirmed', 'confirmed')
     AND created_at > now() - ($3 || ' hours')::interval
     ORDER BY created_at DESC LIMIT 10`,
    [householdId, excludeDraftId || '', timeWindowHours]
  );

  // 2. Check confirmed transactions
  const txCheck = await pool.query(
    `SELECT t.amount, t.category, t.note, w.name as wallet_name, t.date
     FROM transactions t
     LEFT JOIN wallets w ON w.id = t.wallet_id
     WHERE t.household_id = $1
     AND t.created_at > now() - ($2 || ' hours')::interval
     ORDER BY t.created_at DESC LIMIT 20`,
    [householdId, timeWindowHours]
  );

  let bestScore = 0;
  let bestMatch = {};

  // — Score drafts —
  for (const row of draftCheck.rows) {
    let score = 0;
    const reasons = [];

    // Exact fingerprint match (strongest signal)
    if (row.transaction_fingerprint === fingerprint) {
      score += 60;
      reasons.push('exact_fingerprint');
    }

    // Exact image hash (same photo re-uploaded)
    if (row.image_hash === imageHash) {
      score += 45;
      reasons.push('same_image');
    }

    // Fuzzy merchant match against stored analysis
    if (row.analysis) {
      const storedAnalysis = typeof row.analysis === 'string' ? JSON.parse(row.analysis) : row.analysis;

      if (storedAnalysis.amount && analysis.amount) {
        score += fuzzyAmountMatch(storedAnalysis.amount, analysis.amount) * 25;
        reasons.push('amount_match:' + (fuzzyAmountMatch(storedAnalysis.amount, analysis.amount) * 100).toFixed(0) + '%');
      }
      if (storedAnalysis.merchant && analysis.merchant) {
        const mScore = fuzzyMerchantMatch(storedAnalysis.merchant, analysis.merchant);
        score += mScore * 20;
        if (mScore > 0.5) reasons.push('merchant_fuzzy:' + (mScore * 100).toFixed(0) + '%');
      }
      if (storedAnalysis.transaction_date && analysis.transaction_date &&
          storedAnalysis.transaction_date === analysis.transaction_date) {
        score += 15;
        reasons.push('same_date');
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        id: row.id,
        type: 'draft',
        status: row.status,
        reasons,
        created_at: row.created_at,
      };
    }
  }

  // — Score confirmed transactions —
  const normCategory = (analysis.category || '').toLowerCase().trim();
  const normDate = (analysis.transaction_date || '').slice(0, 10);

  for (const row of txCheck.rows) {
    let score = 0;
    const reasons = [];

    // Amount match (+/- 10%)
    if (row.amount && analysis.amount) {
      const amtScore = fuzzyAmountMatch(row.amount, analysis.amount);
      score += amtScore * 30;
      if (amtScore > 0) reasons.push('amount_match:' + (amtScore * 100).toFixed(0) + '%');
    }

    // Date match
    if (row.date && row.date === normDate) {
      score += 20;
      reasons.push('same_date');
    }

    // Category+note contains merchant hint
    if (analysis.merchant && row.note) {
      const mScore = fuzzyMerchantMatch(analysis.merchant, row.note);
      score += mScore * 15;
      if (mScore > 0.5) reasons.push('note_hint:' + (mScore * 100).toFixed(0) + '%');
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        id: row.id || null,
        type: 'transaction',
        reasons,
      };
    }
  }

  const threshold = 50;
  const isDuplicate = bestScore >= threshold;

  return {
    is_possible_duplicate: isDuplicate,
    score: Math.round(bestScore * 100) / 100,
    matched_id: bestMatch.id || null,
    match_type: bestMatch.type || null,
    match_reasons: bestMatch.reasons || [],
  };
}

// ── Config Setter ──────────────────────────────────────────────────

/**
 * Override default time window. Returns the new value.
 */
let _timeWindowHours = DEFAULT_TIME_WINDOW_HOURS;
export function setTimeWindowHours(hours) {
  if (hours > 0 && hours <= 720) {
    _timeWindowHours = hours;
  }
  return _timeWindowHours;
}