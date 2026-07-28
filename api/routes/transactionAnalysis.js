// api/routes/transactionAnalysis.js
// Unified endpoint for transaction image analysis.
// Both WhatsApp and Telegram bot call this — no divergent logic.

import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.js';
import { analyzeTransactionImage, confirmDraft, cancelDraft, analyzeWithPreprocessing } from '../services/transactionImageAnalysisService.js';
import pool from '../db.js';

const router = Router();
router.use(authMiddleware);

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(png|jpe?g|webp)$/.test(file.mimetype)) {
      return cb(new Error('Format harus PNG, JPG, atau WEBP'));
    }
    cb(null, true);
  },
});

async function getUserHouseholdId(userId) {
  const result = await pool.query(
    'SELECT household_id FROM household_members WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  return result.rows[0]?.household_id || null;
}

/**
 * POST /api/transaction-analysis/image
 * Analyze a transaction image WITH full preprocessing pipeline (Sprint 3).
 * Body: multipart with 'image' file, optional 'conversation_context' text.
 */
router.post('/image', (req, res) => {
  imageUpload.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'File gambar wajib diisi' });

    try {
      const householdId = await getUserHouseholdId(req.user.userId);
      if (!householdId) return res.status(400).json({ error: 'Belum punya household' });

      // Use preprocessing wrapper (Sprint 3)
      const result = await analyzeWithPreprocessing({
        imageBuffer: req.file.buffer,
        userId: req.user.userId,
        householdId,
        channel: 'web',
        conversationContext: req.body?.conversation_context || null,
      });

      res.json(result);
    } catch (err) {
      console.error('Transaction analysis error:', err);
      const status = err.message.includes('AI belum') ? 503 : 500;
      res.status(status).json({ error: err.message || 'Gagal menganalisis gambar' });
    }
  });
});

/**
 * POST /api/transaction-analysis/drafts/:id/confirm
 * Confirm a draft and save as actual transaction.
 * Body: optional corrections object { category, amount, wallet_id, ... }
 */
router.post('/drafts/:id/confirm', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.status(400).json({ error: 'Belum punya household' });

    const result = await confirmDraft(
      req.params.id,
      req.user.userId,
      householdId,
      req.body?.corrections || {}
    );
    res.json(result);
  } catch (err) {
    console.error('Confirm draft error:', err);
    res.status(400).json({ error: err.message });
  }
});

/**
 * PATCH /api/transaction-analysis/drafts/:id
 * Update a draft with corrections before confirming.
 */
router.patch('/drafts/:id', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.status(400).json({ error: 'Belum punya household' });

    const result = await pool.query(
      `UPDATE transaction_analysis_drafts
       SET analysis = analysis || $1, updated_at = now()
       WHERE id = $2 AND household_id = $3 AND status = 'pending'
       RETURNING id, analysis`,
      [JSON.stringify(req.body), req.params.id, householdId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Draft tidak ditemukan' });
    }
    res.json({ draft: result.rows[0] });
  } catch (err) {
    console.error('Update draft error:', err);
    res.status(500).json({ error: 'Gagal memperbarui draft' });
  }
});

/**
 * DELETE /api/transaction-analysis/drafts/:id
 * Cancel a draft.
 */
router.delete('/drafts/:id', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.status(400).json({ error: 'Belum punya household' });

    const cancelled = await cancelDraft(req.params.id, householdId);
    if (!cancelled) return res.status(404).json({ error: 'Draft tidak ditemukan' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Cancel draft error:', err);
    res.status(500).json({ error: 'Gagal membatalkan draft' });
  }
});

// POST /api/transaction-analysis/feedback — user feedback for learning
router.post('/feedback', authMiddleware, async (req, res) => {
  try {
    const { feedback_type, draft_id, transaction_id, corrected_fields } = req.body;
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.status(400).json({ error: 'Belum ada household' });

    // If draft_id is provided, load the original analysis
    let originalAnalysis = null;
    let ocrText = '';
    if (draft_id) {
      const draft = await pool.query(
        'SELECT analysis FROM transaction_analysis_drafts WHERE id = $1 AND household_id = $2',
        [draft_id, householdId]
      );
      if (draft.rows.length > 0) {
        originalAnalysis = draft.rows[0].analysis;
        ocrText = originalAnalysis?.ocr_text || '';
      }
    } else if (transaction_id) {
      // Load from transaction — no analysis stored, reconstruct what we can
      const tx = await pool.query(
        'SELECT category, amount, note, type as transaction_type, date as transaction_date FROM transactions WHERE id = $1 AND household_id = $2',
        [transaction_id, householdId]
      );
      if (tx.rows.length > 0) {
        originalAnalysis = tx.rows[0];
      }
    }

    const { processFeedback } = await import('../services/feedbackLearning.js');
    const result = await processFeedback({
      householdId,
      userId: req.user.userId,
      feedbackType: feedback_type,
      originalAnalysis,
      correctedFields: corrected_fields || {},
      channel: 'web',
      draftId: draft_id,
      transactionId: transaction_id,
      ocrText,
    });

    res.json({
      success: true,
      result,
      message: result.personal_rule
        ? 'Terima kasih! Feedback diterima dan sistem belajar untuk kasus serupa ke depan.'
        : 'Terima kasih! Feedback diterima.'
    });
  } catch (err) {
    console.error('Feedback error:', err);
    res.status(500).json({ error: err.message || 'Gagal memproses feedback' });
  }
});

// POST /api/transaction-analysis/bootstrap — learn from existing transaction history
router.post('/bootstrap', authMiddleware, async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.status(400).json({ error: 'Belum ada household' });

    const { bootstrapWalletIdentifiers } = await import('../services/walletIdentifiers.js');
    const { learnFromHistory } = await import('../services/merchantMapping.js');

    const [walletResult, merchantResult] = await Promise.all([
      bootstrapWalletIdentifiers(householdId).catch(() => ({ scanned: 0, created: 0 })),
      learnFromHistory(householdId).catch(() => ({ scanned: 0, created: 0 })),
    ]);

    res.json({
      success: true,
      wallet_identifiers: walletResult,
      merchant_mappings: merchantResult,
      message: `Bootstrap selesai. ${walletResult.created} wallet identifier + ${merchantResult.created} merchant mapping baru.`,
    });
  } catch (err) {
    console.error('Bootstrap error:', err);
    res.status(500).json({ error: 'Gagal bootstrap' });
  }
});

export default router;
