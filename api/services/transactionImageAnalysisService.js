// api/services/transactionImageAnalysisService.js
// Unified transaction image analysis engine.
// Both WhatsApp and Telegram call this ONE service — no divergent logic.
//
// Flow: image → preprocess → OCR → regex → LLM → wallet resolve → validate → draft

import crypto from 'crypto';
import { extractText, tryRegexExtraction, sanitizeDate } from './receiptExtraction.js';
import { generateChatText } from './aiProvider.js';
import { getSetting } from './appSettings.js';
import pool from '../db.js';
import { checkDuplicate } from './duplicateTransactionDetector.js';

// ---------- Helpers ----------

function parseIndonesianNumber(str) {
  let s = String(str || '').trim();
  const decimalMatch = s.match(/,(\d{2})$/);
  let decimals = '';
  if (decimalMatch) {
    decimals = '.' + decimalMatch[1];
    s = s.slice(0, decimalMatch.index);
  }
  s = s.replace(/[.,]/g, '');
  return Number(s + decimals) || 0;
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' dan ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function getUserWallets(householdId) {
  const result = await pool.query(
    `SELECT id, name, is_default
     FROM wallets WHERE household_id = $1 ORDER BY is_default DESC, name ASC`,
    [householdId]
  );
  return result.rows;
}

async function getUserCategories(householdId) {
  const result = await pool.query(
    `SELECT id, name, type FROM categories
     WHERE household_id = $1 ORDER BY is_default DESC, sort_order ASC, name ASC`,
    [householdId]
  );
  return result.rows;
}

async function getRecentTransactions(householdId, limit = 20) {
  const result = await pool.query(
    `SELECT t.type, t.category, t.amount, t.note, t.wallet_id, w.name as wallet_name
     FROM transactions t
     LEFT JOIN wallets w ON w.id = t.wallet_id
     WHERE t.household_id = $1
     ORDER BY t.date DESC, t.created_at DESC LIMIT $2`,
    [householdId, limit]
  );
  return result.rows;
}

async function getPersonalRules(householdId) {
  const result = await pool.query(
    `SELECT rule_type, pattern, result FROM user_transaction_rules
     WHERE household_id = $1 ORDER BY usage_count DESC, created_at DESC LIMIT 20`,
    [householdId]
  );
  return result.rows;
}

async function getMerchantMappings(householdId, merchantText) {
  if (!merchantText) return [];
  const norm = normalizeText(merchantText);
  if (!norm) return [];
  const result = await pool.query(
    `SELECT merchant_normalized, transaction_type, category, subcategory
     FROM merchant_category_mappings
     WHERE (household_id = $1 OR household_id IS NULL)
     AND $2 ILIKE '%' || merchant_normalized || '%'
     ORDER BY household_id NULLS LAST, usage_count DESC LIMIT 5`,
    [householdId, norm]
  );
  return result.rows;
}

// ---------- Prompt Builder ----------

function buildAnalysisPrompt({
  ocrText, wallets, categories, recentTx, personalRules, merchantHints, conversationContext
}) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const today = now.toISOString().slice(0, 10);

  const walletsJson = JSON.stringify(wallets.map(w => ({
    id: w.id, name: w.name, type: w.type, is_default: w.is_default
  })), null, 2);

  const categoriesJson = JSON.stringify(categories.map(c => ({
    id: c.id, name: c.name, type: c.type
  })), null, 2);

  const recentTxJson = JSON.stringify(recentTx.slice(0, 10).map(t => ({
    type: t.type, category: t.category, amount: t.amount,
    note: t.note, wallet: t.wallet_name
  })), null, 2);

  const personalRulesJson = JSON.stringify(personalRules, null, 2);
  const merchantHintsJson = JSON.stringify(merchantHints, null, 2);
  const ctxStr = conversationContext || '(tidak ada konteks tambahan)';

  return [
    'Kamu adalah mesin ekstraksi dan klasifikasi transaksi keuangan untuk aplikasi FinePro.',
    'Tugasmu membaca bukti transaksi dari hasil OCR dan menghasilkan JSON valid.',
    '',
    `TAHUN SEKARANG: ${currentYear}, TANGGAL HARI INI: ${today}`,
    '',
    'ATURAN KLASIFIKASI:',
    '1. Transfer dari pihak lain ke wallet milik pengguna = income',
    '2. Pembayaran dari wallet pengguna ke merchant = expense',
    '3. Transfer antar-wallet milik pengguna = transfer',
    '4. Top-up e-wallet dari rekening pengguna ke e-wallet pengguna = transfer',
    '5. Refund masuk = income (atau refund jika konteks jelas)',
    '6. Struk belanja merchant retail/restoran = expense',
    '7. Bukti tanpa arah dana yang jelas = uncertain',
    '',
    'PRIORITAS KLASIFIKASI:',
    '1. Aturan personal pengguna',
    '2. Mapping wallet pengguna',
    '3. Histori transaksi pengguna',
    '4. Merchant database hints',
    '5. Bukti visual/OCR',
    '6. Konfirmasi manual',
    '',
    'OCR_TEXT:',
    '"""',
    ocrText || '(kosong)',
    '"""',
    '',
    'CONVERSATION_CONTEXT:',
    ctxStr,
    '',
    'USER_WALLETS:',
    walletsJson,
    '',
    'USER_CATEGORIES:',
    categoriesJson,
    '',
    'RECENT_TRANSACTIONS:',
    recentTxJson,
    '',
    'PERSONAL_RULES:',
    personalRulesJson,
    '',
    'MERCHANT_HINTS:',
    merchantHintsJson,
    '',
    'Kembalikan HANYA JSON valid dengan schema berikut:',
    '{',
    '  "document_type": "receipt|invoice|bank_transfer|mobile_banking_screenshot|ewallet_payment|unknown",',
    '  "transaction_type": "expense|income|transfer|uncertain",',
    '  "amount": <angka bersih>',
    '  "currency": "IDR",',
    '  "transaction_date": "YYYY-MM-DD",',
    '  "transaction_time": "HH:MM atau null",',
    '  "merchant": "<nama merchant atau null>",',
    '  "sender_name": "<nama pengirim atau null>",',
    '  "recipient_name": "<nama penerima atau null>",',
    '  "source_wallet_id": "<wallet uuid atau null>",',
    '  "source_wallet_name": "<nama wallet atau null>",',
    '  "destination_wallet_id": "<wallet uuid atau null>",',
    '  "destination_wallet_name": "<nama wallet atau null>",',
    '  "category": "<nama kategori atau null>",',
    '  "subcategory": "<nama subkategori atau null>",',
    '  "description": "<deskripsi singkat>",',
    '  "reference_number": "<nomor ref atau null>",',
    '  "admin_fee": <angka atau 0>,',
    '  "confidence": {',
    '    "transaction_type": 0.0-1.0,',
    '    "amount": 0.0-1.0,',
    '    "transaction_date": 0.0-1.0,',
    '    "merchant": 0.0-1.0,',
    '    "source_wallet": 0.0-1.0,',
    '    "destination_wallet": 0.0-1.0,',
    '    "category": 0.0-1.0',
    '  },',
    '  "needs_confirmation": true|false,',
    '  "confirmation_fields": ["field1", "field2"]',
    '}',
    '',
    'CATATAN:',
    '- Gunakan tahun ' + currentYear + ' jika teks tidak menyebut tahun.',
    '- amount = angka BERSIH (bukan subtotal + pajak, ambil angka TERBESAR yang masuk akal).',
    '- source_wallet_id: pilih dari USER_WALLETS berdasarkan nama bank/logo/aplikasi/rekening.',
    '- Jika tidak yakin wallet, set null dan needs_confirmation=true.',
    '- Jika transaction_type uncertain, set needs_confirmation=true.',
    '- confidence < 0.7 untuk field penting = tambahkan ke confirmation_fields.',
    '- Jangan mengarang data yang tidak terlihat di OCR.',
  ].join('\n');
}

// ---------- Core Analysis Function ----------

export async function analyzeTransactionImage({
  imageBuffer,
  mimeType,
  userId,
  householdId,
  channel = 'web',
  conversationContext = null,
}) {
  if (!imageBuffer || !householdId) {
    throw new Error('imageBuffer dan householdId wajib diisi');
  }

  // 1. OCR
  const ocrText = await extractText(imageBuffer);

  // 1b. Try personal rules bypass (Sprint 2 — zero-cost, no AI needed)
  const { tryPersonalRulesBypass, applyRules, getActiveRules } = await import('./personalRulesEngine.js');
  const bypass = await tryPersonalRulesBypass(householdId, ocrText);
  if (bypass) {
    // Quick save without AI
    const draftId = await saveDraft({
      householdId, userId, channel, imageHash: '',
      analysis: { ...bypass, ocr_text: ocrText },
    });
    const imageHash = crypto.createHash('sha256').update(imageBuffer).digest('hex');
    const dupCheck = await checkDuplicate(householdId, bypass, imageHash, draftId);
    return {
      draft_id: draftId,
      ...bypass,
      image_hash: imageHash,
      used_ai: false,
      ocr_text_length: ocrText.length,
      duplicate_check: dupCheck,
      bypass: true,
    };
  }

  // 1c. Apply personal rules to boost AI prompt context
  const activeRules = await getActiveRules(householdId).catch(() => []);

  // 2. Fetch user context
  const [wallets, categories, recentTx, personalRules] = await Promise.all([
    getUserWallets(householdId),
    getUserCategories(householdId),
    getRecentTransactions(householdId, 20),
    getPersonalRules(householdId).catch(() => []),
  ]);

  // 3. Merchant hints (preliminary — from OCR first line)
  const firstLine = (ocrText.split('\n').find((l) => l.trim().length > 3) || '').trim().slice(0, 80);
  const merchantHints = await getMerchantMappings(householdId, firstLine).catch(() => []);

  // 4. Try regex first (fast, free)
  let parsed = tryRegexExtraction(ocrText);
  let usedAi = false;

  if (!parsed) {
    const aiConfig = await getSetting('ai');
    if (!aiConfig || !aiConfig.enabled) {
      throw new Error('AI belum dikonfigurasi dan regex tidak dapat membaca struk');
    }
    usedAi = true;

    const prompt = buildAnalysisPrompt({
      ocrText,
      wallets,
      categories,
      recentTx,
      personalRules,
      merchantHints,
      conversationContext,
    });

    const text = await generateChatText({
      config: aiConfig,
      maxTokens: 600,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = text.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    parsed = JSON.parse(raw);
  }

  // 5. Normalize and enrich
  const result = await enrichAnalysis(parsed, { ocrText, wallets, categories, householdId });

  // 6. Compute image hash for duplicate detection
  const imageHash = crypto.createHash('sha256').update(imageBuffer).digest('hex');

  // 7. Save draft
  const draftId = await saveDraft({
    householdId,
    userId,
    channel,
    imageHash,
    analysis: result,
  });

  // 8. Duplicate check (exclude this draft)
  const dupCheck = await checkDuplicate(householdId, result, imageHash, draftId);

  return {
    draft_id: draftId,
    ...result,
    image_hash: imageHash,
    used_ai: usedAi,
    ocr_text_length: ocrText.length,
    duplicate_check: dupCheck,
  };
}

// ---------- Enrichment ----------

async function enrichAnalysis(parsed, { ocrText, wallets, categories, householdId }) {
  const result = {
    document_type: parsed.document_type || 'unknown',
    transaction_type: parsed.transaction_type || 'uncertain',
    amount: Number(parsed.amount) || 0,
    currency: parsed.currency || 'IDR',
    transaction_date: sanitizeDate(parsed.transaction_date, ocrText),
    transaction_time: parsed.transaction_time || null,
    merchant: parsed.merchant || null,
    sender_name: parsed.sender_name || null,
    recipient_name: parsed.recipient_name || null,
    source_wallet_id: parsed.source_wallet_id || null,
    source_wallet_name: parsed.source_wallet_name || null,
    destination_wallet_id: parsed.destination_wallet_id || null,
    destination_wallet_name: parsed.destination_wallet_name || null,
    category: parsed.category || null,
    subcategory: parsed.subcategory || null,
    description: parsed.description || parsed.note || '',
    reference_number: parsed.reference_number || null,
    admin_fee: Number(parsed.admin_fee) || 0,
    confidence: {
      transaction_type: parsed.confidence?.transaction_type ?? 0.5,
      amount: parsed.confidence?.amount ?? 0.5,
      transaction_date: parsed.confidence?.transaction_date ?? 0.5,
      merchant: parsed.confidence?.merchant ?? 0.5,
      source_wallet: parsed.confidence?.source_wallet ?? 0.5,
      destination_wallet: parsed.confidence?.destination_wallet ?? 0.5,
      category: parsed.confidence?.category ?? 0.5,
    },
    needs_confirmation: false,
    confirmation_fields: [],
  };

  // Resolve wallet IDs from names if not provided
  if (!result.source_wallet_id && result.source_wallet_name) {
    const w = wallets.find((w) =>
      normalizeText(w.name).includes(normalizeText(result.source_wallet_name))
    );
    if (w) {
      result.source_wallet_id = w.id;
      result.source_wallet_name = w.name;
    }
  }

  if (!result.destination_wallet_id && result.destination_wallet_name) {
    const w = wallets.find((w) =>
      normalizeText(w.name).includes(normalizeText(result.destination_wallet_name))
    );
    if (w) {
      result.destination_wallet_id = w.id;
      result.destination_wallet_name = w.name;
    }
  }

  // If still no source_wallet for expense, try default wallet
  if (result.transaction_type === 'expense' && !result.source_wallet_id) {
    const def = wallets.find((w) => w.is_default);
    if (def) {
      result.source_wallet_id = def.id;
      result.source_wallet_name = def.name;
    }
  }

  // Match category to user's actual categories
  if (result.category) {
    const cat = categories.find((c) =>
      normalizeText(c.name).includes(normalizeText(result.category).split(' ')[0])
    );
    if (cat) {
      result.category = cat.name;
      result.category_id = cat.id;
      // Boost category confidence if match found
      if (result.confidence.category < 0.8) result.confidence.category = 0.85;
    }
  }

  // Sprint 2: Merchant mapping — if no category from AI, try merchant mapping
  if (!result.category && result.merchant) {
    try {
      const { getMerchantMapping } = await import('./merchantMapping.js');
      const mapping = await getMerchantMapping(householdId, result.merchant, result.transaction_type);
      if (mapping) {
        result.category = mapping.category;
        result.subcategory = mapping.subcategory;
        result.confidence.category = mapping.confidence;
        result.category_source = mapping.source;
        // Match to actual user category
        const cat = categories.find((c) =>
          normalizeText(c.name).includes(normalizeText(mapping.category).split(' ')[0])
        );
        if (cat) {
          result.category = cat.name;
          result.category_id = cat.id;
        }
      }
    } catch (e) { /* mapping failure is non-fatal */ }
  }

  // Sprint 2: Wallet identifier matching — if no wallet from name matching
  if (!result.source_wallet_id && result.transaction_type !== 'income') {
    try {
      const { matchWallet } = await import('./walletIdentifiers.js');
      const walletMatch = await matchWallet(householdId, enrichAnalysis.caller?.ocrText || '');
      // Note: ocrText is not available in enrichAnalysis — this is a fallback
      // Real wallet identifier matching happens in the main function when ocrText is available
    } catch (e) { /* wallet id failure is non-fatal */ }
  }

  // Compute overall confidence
  const confValues = Object.values(result.confidence);
  result.overall_confidence = confValues.length > 0
    ? Math.round((confValues.reduce((a, b) => a + b, 0) / confValues.length) * 100) / 100
    : 0.5;

  // Validate
  const validation = validateAnalysis(result);
  result.needs_confirmation = validation.needs_confirmation;
  result.confirmation_fields = validation.confirmation_fields;

  return result;
}

// ---------- Validator ----------

export function validateAnalysis(analysis) {
  const allFields = ['transaction_type', 'amount', 'transaction_date',
    'source_wallet', 'destination_wallet', 'category'];
  const required = [];
  const lowConfFields = [];

  // Hard requirements
  if (!['income', 'expense', 'transfer', 'uncertain'].includes(analysis.transaction_type)) {
    required.push('transaction_type');
  }

  if (analysis.transaction_type === 'uncertain') {
    required.push('transaction_type');
  }

  if (!analysis.amount || analysis.amount <= 0) {
    required.push('amount');
  }

  if (!analysis.transaction_date) {
    required.push('transaction_date');
  }

  if (analysis.transaction_type === 'expense' && !analysis.source_wallet_id) {
    required.push('source_wallet');
  }

  if (analysis.transaction_type === 'income' && !analysis.destination_wallet_id && !analysis.source_wallet_id) {
    required.push('destination_wallet');
  }

  if (analysis.transaction_type === 'transfer') {
    if (!analysis.source_wallet_id) required.push('source_wallet');
    if (!analysis.destination_wallet_id) required.push('destination_wallet');
  }

  if (analysis.transaction_type !== 'transfer' && !analysis.category) {
    required.push('category');
  }

  // Confidence-based flags — fields with low confidence but not already required
  const confChecks = [
    { field: 'transaction_type', key: 'transaction_type', threshold: 0.7 },
    { field: 'amount', key: 'amount', threshold: 0.85 },
    { field: 'transaction_date', key: 'transaction_date', threshold: 0.7 },
    { field: 'source_wallet', key: 'source_wallet', threshold: 0.7 },
    { field: 'destination_wallet', key: 'destination_wallet', threshold: 0.7 },
    { field: 'category', key: 'category', threshold: 0.7 },
  ];

  for (const check of confChecks) {
    const confValue = analysis.confidence?.[check.key] ?? 0;
    if (confValue < check.threshold && !required.includes(check.field)) {
      lowConfFields.push(check.field);
    }
  }

  const allConfirmationFields = [...new Set([...required, ...lowConfFields])];
  const hasRequired = required.length > 0;
  const hasLowConf = lowConfFields.length > 0;
  const overallLow = (analysis.overall_confidence || 0) < 0.9;

  return {
    needs_confirmation: hasRequired || hasLowConf || overallLow,
    confirmation_fields: allConfirmationFields,
    required_fields: required,
    low_confidence_fields: lowConfFields,
  };
}

// ---------- Draft Persistence ----------

async function saveDraft({ householdId, userId, channel, imageHash, analysis }) {
  const fingerprint = buildFingerprint(analysis);

  // Check existing pending draft with same fingerprint
  const existing = await pool.query(
    `SELECT id FROM transaction_analysis_drafts
     WHERE household_id = $1 AND transaction_fingerprint = $2 AND status = 'pending'
     AND created_at > now() - interval '24 hours' LIMIT 1`,
    [householdId, fingerprint]
  );
  if (existing.rows.length > 0) {
    // Update existing draft with fresh analysis
    await pool.query(
      `UPDATE transaction_analysis_drafts SET analysis = $1, image_hash = $2, updated_at = now()
       WHERE id = $3`,
      [JSON.stringify(analysis), imageHash, existing.rows[0].id]
    );
    return existing.rows[0].id;
  }

  // Insert new draft
  const transactionId = await pool.query(
    `INSERT INTO transaction_analysis_drafts
     (household_id, user_id, source_channel, image_hash, transaction_fingerprint, status, analysis, expires_at)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6, now() + interval '24 hours')
     RETURNING id`,
    [
      householdId,
      userId,
      channel,
      imageHash,
      fingerprint,
      JSON.stringify(analysis),
    ]
  );
  return transactionId.rows[0].id;
}

function buildFingerprint(analysis) {
  const parts = [
    analysis.amount,
    analysis.transaction_date,
    normalizeText(analysis.merchant || ''),
    analysis.reference_number || '',
    analysis.source_wallet_id || '',
    analysis.destination_wallet_id || '',
  ];
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

// ---------- Confirm Draft (save actual transaction) ----------

export async function confirmDraft(draftId, userId, householdId, corrections = {}) {
  const draftResult = await pool.query(
    `SELECT * FROM transaction_analysis_drafts WHERE id = $1 AND household_id = $2 AND status = 'pending'`,
    [draftId, householdId]
  );

  if (draftResult.rows.length === 0) {
    throw new Error('Draft tidak ditemukan atau sudah dikonfirmasi');
  }

  const draft = draftResult.rows[0];
  const analysis = { ...JSON.parse(JSON.stringify(draft.analysis)), ...corrections };

  // Resolve wallet
  let walletId = analysis.source_wallet_id;
  if (analysis.transaction_type === 'income' && analysis.destination_wallet_id) {
    walletId = analysis.destination_wallet_id;
  }
  if (analysis.transaction_type === 'transfer' && analysis.source_wallet_id) {
    walletId = analysis.source_wallet_id;
  }
  if (!walletId) {
    const def = await pool.query(
      'SELECT id FROM wallets WHERE household_id = $1 AND is_default = true LIMIT 1',
      [householdId]
    );
    walletId = def.rows[0]?.id || null;
  }

  // Save transaction
  const txResult = await pool.query(
    `INSERT INTO transactions (household_id, created_by, date, type, category, amount, note, wallet_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, to_char(date, 'YYYY-MM-DD') as date, type, category, amount, note, created_at, wallet_id`,
    [
      householdId,
      userId,
      analysis.transaction_date,
      analysis.transaction_type === 'transfer' ? 'expense' : analysis.transaction_type,
      analysis.category || 'Lainnya',
      analysis.amount,
      analysis.description || analysis.merchant || '',
      walletId,
    ]
  );

  // Update draft status
  await pool.query(
    `UPDATE transaction_analysis_drafts SET status = 'confirmed', confirmed_transaction_id = $1, updated_at = now() WHERE id = $2`,
    [txResult.rows[0].id, draftId]
  );

  // Save feedback if corrections were made
  const correctedFields = Object.keys(corrections);
  if (correctedFields.length > 0) {
    await pool.query(
      `INSERT INTO transaction_analysis_feedback
       (household_id, user_id, draft_id, transaction_id, original_analysis, corrected_fields, source_channel)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        householdId,
        userId,
        draftId,
        txResult.rows[0].id,
        JSON.stringify(draft.analysis),
        JSON.stringify(corrections),
        draft.source_channel,
      ]
    );

    // Sprint 2: Feed corrections into intelligence layer
    try {
      const { processFeedback } = await import('./feedbackLearning.js');
      await processFeedback({
        householdId,
        userId,
        feedbackType: 'corrected',
        originalAnalysis: draft.analysis,
        correctedFields: corrections,
        channel: draft.source_channel,
        draftId,
        transactionId: txResult.rows[0].id,
        ocrText: draft.analysis?.ocr_text || '',
      });
    } catch (e) {
      console.error('Feedback learning error (non-fatal):', e);
    }
  } else {
    // Sprint 2: No corrections — positive feedback, boost merchant mapping
    try {
      const { processFeedback } = await import('./feedbackLearning.js');
      await processFeedback({
        householdId,
        userId,
        feedbackType: 'correct',
        originalAnalysis: draft.analysis,
        correctedFields: {},
        channel: draft.source_channel,
        draftId,
        transactionId: txResult.rows[0].id,
        ocrText: draft.analysis?.ocr_text || '',
      });
    } catch (e) {
      console.error('Feedback learning error (non-fatal):', e);
    }
  }

  return { transaction: txResult.rows[0] };
}

// ---------- Cancel Draft ----------

export async function cancelDraft(draftId, householdId) {
  const result = await pool.query(
    `UPDATE transaction_analysis_drafts SET status = 'cancelled', updated_at = now()
     WHERE id = $1 AND household_id = $2 AND status = 'pending' RETURNING id`,
    [draftId, householdId]
  );
  return result.rows.length > 0;
}
