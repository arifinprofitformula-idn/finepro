// api/routes/transactionAnalysis.js
// Unified endpoint for transaction image analysis.
// Both WhatsApp and Telegram bot call this — no divergent logic.

import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.js';
import { analyzeTransactionImage, confirmDraft, cancelDraft } from '../services/transactionImageAnalysisService.js';
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
 * Analyze a transaction image and return structured draft.
 * Body: multipart with 'image' file, optional 'conversation_context' text.
 */
router.post('/image', (req, res) => {
  imageUpload.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'File gambar wajib diisi' });

    try {
      const householdId = await getUserHouseholdId(req.user.userId);
      if (!householdId) return res.status(400).json({ error: 'Belum punya household' });

      const result = await analyzeTransactionImage({
        imageBuffer: req.file.buffer,
        mimeType: req.file.mimetype,
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

export default router;
