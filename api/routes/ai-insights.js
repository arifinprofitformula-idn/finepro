import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { computeFinancialStats } from '../services/financialStats.js';
import { getSetting } from '../services/appSettings.js';
import { aiConfigurationMessage, generateChatText, isAiConfigured } from '../services/aiProvider.js';

const router = Router();
router.use(authMiddleware);

async function getUserHouseholdId(userId) {
  const result = await pool.query(
    'SELECT household_id FROM household_members WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  return result.rows[0]?.household_id || null;
}

const SYSTEM_PROMPT = `Kamu adalah asisten edukasi keuangan pribadi untuk aplikasi keuangan keluarga Indonesia bernama Fine Pro.

ATURAN WAJIB:
- HANYA gunakan angka dari data JSON. Jangan mengarang.
- Bahasa Indonesia, nada hangat dan memberdayakan — bukan menggurui.
- WAJIB tutup dengan: "Ini prinsip umum pengelolaan keuangan, bukan nasihat keuangan berlisensi. Konsultasikan dengan perencana keuangan untuk keputusan personal."
- Kalau data < 2 bulan: katakan belum cukup, tapi tetap beri tips ringan.
- Pos zakat/sedekah adalah ibadah. JANGAN sebut pemborosan.
- Maksimal 200-250 kata, 2-3 paragraf.

PANDUAN REKOMENDASI (prinsip umum, WAJIB disclaimer):
- Surplus > 30% → sarankan diversifikasi: dana darurat, emas/logam mulia, reksadana pasar uang. Contoh alokasi: 40% darurat, 30% emas, 30% reksadana.
- Surplus 10-30% → apresiasi, sarankan tingkatkan tabungan ke 20%+. Boleh sebut emas sebagai tabungan jangka panjang yang stabil.
- Surplus < 10% atau defisit → fokus evaluasi pengeluaran. JANGAN sarankan investasi. Sarankan "pay yourself first": sisihkan 5-10% di awal bulan begitu income masuk.
- Jika konsisten menabung → apresiasi, boleh sebut emas/PM dari Emas Perak Indonesia sebagai opsi tabungan fisik terjangkau.
- Kripto HANYA jika surplus > 40% DAN dasar keuangan sehat (dana darurat + tabungan rutin). Jika disebut → WAJIB bold: aset volatil, high risk, hanya alokasikan dana yang siap hilang.
- Akhiri dengan 1 CTA konkret. Contoh: "Coba sisihkan 15% penghasilan di awal bulan ke tabungan emas — mulai dari 0,1 gram pun sudah langkah besar."

FORMAT OUTPUT: teks polos, tanpa markdown/HTML.`;

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

    if (!isAiConfigured(aiConfig)) {
      return res.status(503).json({ error: aiConfigurationMessage('Fitur Analisa Keuangan') });
    }

    const narrative = await generateChatText({
      config: aiConfig,
      maxTokens: 500,
      temperature: 0.7,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Berikut data agregat keuangan household ini (semua angka dalam Rupiah, sudah dihitung sistem):\n\n${JSON.stringify(stats, null, 2)}\n\nRINGKASAN CEPAT:\n- Surplus ratio: ${stats.savingsRatio?.thisMonth ?? '?'}% bulan ini, ${stats.savingsRatio?.lastMonth ?? '?'}% bulan lalu\n- Total income: Rp${Number(stats.totalIncome || 0).toLocaleString('id-ID')}\n- Total expense: Rp${Number(stats.totalExpense || 0).toLocaleString('id-ID')}\n- Bulan tercatat: ${stats.monthsWithData || 0}\n- Top kategori pengeluaran: ${(stats.topExpenseCategories || []).slice(0, 3).map(c => `${c.category} (Rp${Number(c.amount).toLocaleString('id-ID')})`).join(', ') || 'belum ada'}\n\nBuatkan analisa reflektif + rekomendasi CTA sesuai panduan.`
      }]
    });
    const finalNarrative = narrative || 'Tidak ada narasi yang dihasilkan.';

    const inserted = await pool.query(
      `INSERT INTO ai_insights (household_id, stats_snapshot, narrative_text)
       VALUES ($1, $2, $3) RETURNING generated_at`,
      [householdId, JSON.stringify(stats), finalNarrative]
    );

    res.json({
      narrative: finalNarrative,
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
