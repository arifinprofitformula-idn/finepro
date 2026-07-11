import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { computeFinancialStats } from '../services/financialStats.js';
import { getSetting } from '../services/appSettings.js';

const router = Router();
router.use(authMiddleware);

async function getUserHouseholdId(userId) {
  const result = await pool.query(
    'SELECT household_id FROM household_members WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  return result.rows[0]?.household_id || null;
}

const SYSTEM_PROMPT = `Kamu adalah asisten edukasi keuangan pribadi untuk aplikasi keuangan keluarga Indonesia.
ATURAN WAJIB — tidak boleh dilanggar:
- HANYA gunakan angka yang ada di data JSON yang diberikan. Jangan mengarang atau mengasumsikan angka/fakta lain.
- JANGAN merekomendasikan produk investasi spesifik (saham tertentu, reksadana tertentu, kripto, emas, dll).
- JANGAN menjanjikan hasil keuangan apapun ("pasti untung", "dijamin", dsb).
- WAJIB pakai Bahasa Indonesia, nada tenang dan reflektif, bukan menggurui atau menghakimi.
- WAJIB menutup narasi dengan mengingatkan bahwa ini bukan nasihat keuangan berlisensi.
- Kalau data menunjukkan riwayat kurang dari 2 bulan, katakan datanya belum cukup untuk dianalisis mendalam.
- Panjang narasi maksimal sekitar 150-200 kata, 2-3 paragraf pendek.`;

// POST /api/ai/insights — analisa on-demand, dipicu manual lewat tombol di dashboard
router.post('/insights', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.status(400).json({ error: 'Belum punya household' });
    const aiConfig = await getSetting('ai');
    const dailyLimit = Number(aiConfig.insights_daily_limit || 3);

    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM ai_insights WHERE household_id = $1 AND generated_at >= CURRENT_DATE`,
      [householdId]
    );
    const usedToday = Number(countResult.rows[0].count);

    if (usedToday >= dailyLimit) {
      const cached = await pool.query(
        `SELECT narrative_text, generated_at FROM ai_insights
         WHERE household_id = $1 ORDER BY generated_at DESC LIMIT 1`,
        [householdId]
      );
      return res.json({
        narrative: cached.rows[0]?.narrative_text || null,
        generated_at: cached.rows[0]?.generated_at || null,
        rateLimited: true,
        remaining: 0,
        message: `Sudah generate analisa ${dailyLimit}x hari ini. Coba lagi besok — ini hasil analisa terakhir Anda.`
      });
    }

    const stats = await computeFinancialStats(householdId);

    if (stats.insufficientData) {
      const narrative = `Data transaksi Anda baru tercatat ${stats.monthsWithData} bulan. Catat transaksi rutin minimal 2 bulan berturut-turut supaya Analisa Keuangan bisa membaca pola pemasukan dan pengeluaran dengan lebih akurat.`;
      return res.json({ narrative, stats, rateLimited: false, remaining: dailyLimit - usedToday });
    }

    const apiKey = aiConfig.anthropic_api_key;
    if (!aiConfig.enabled || !apiKey || apiKey === 'isi-anthropic-api-key') {
      return res.status(503).json({ error: 'Fitur Analisa Keuangan belum dikonfigurasi (ANTHROPIC_API_KEY belum diisi)' });
    }

    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: aiConfig.model || 'claude-sonnet-4-5',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Berikut data agregat keuangan household ini (semua angka dalam Rupiah, sudah dihitung sistem, bukan asumsi):\n\n${JSON.stringify(stats, null, 2)}\n\nBuatkan analisa dan refleksi singkat berdasarkan data ini.`
      }]
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    const narrative = textBlock?.text?.trim() || 'Tidak ada narasi yang dihasilkan.';

    const inserted = await pool.query(
      `INSERT INTO ai_insights (household_id, stats_snapshot, narrative_text)
       VALUES ($1, $2, $3) RETURNING generated_at`,
      [householdId, JSON.stringify(stats), narrative]
    );

    res.json({
      narrative,
      stats,
      generated_at: inserted.rows[0].generated_at,
      rateLimited: false,
      remaining: dailyLimit - usedToday - 1
    });
  } catch (err) {
    console.error('AI insight error:', err);
    res.status(500).json({ error: 'Gagal membuat analisa keuangan' });
  }
});

export default router;
