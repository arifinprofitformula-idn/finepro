import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { computeFinancialStats } from '../services/financialStats.js';
import { getSetting } from '../services/appSettings.js';
import { aiConfigurationMessage, generateChatText, isAiConfigured } from '../services/aiProvider.js';
import { getQuotaStatus, recordAiUsage } from '../services/aiUsage.js';
import { getCurrentMetalPrices } from '../services/apeEpi.js';

const router = Router();
router.use(authMiddleware);

async function getUserHouseholdId(userId) {
  const result = await pool.query(
    'SELECT household_id FROM household_members WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  return result.rows[0]?.household_id || null;
}

async function getActiveSavingsGoals(householdId) {
  try {
    const result = await pool.query(
      `SELECT
         g.id, g.name, g.goal_type, g.target_amount, g.target_weight,
         to_char(g.target_date, 'YYYY-MM-DD') as target_date, g.status,
         COALESCE(SUM(c.amount_paid), 0) as total_amount_paid,
         COALESCE(SUM(c.weight), 0) as total_weight,
         COUNT(c.id)::int as contribution_count,
         CASE
           WHEN g.goal_type = 'money' AND g.target_amount > 0
             THEN LEAST(100, ROUND((COALESCE(SUM(c.amount_paid), 0) / g.target_amount) * 100))
           WHEN g.goal_type <> 'money' AND g.target_weight > 0
             THEN LEAST(100, ROUND((COALESCE(SUM(c.weight), 0) / g.target_weight) * 100))
           ELSE 0
         END as progress_percent
       FROM savings_goals g
       LEFT JOIN savings_goal_contributions c ON c.goal_id = g.id
       WHERE g.household_id = $1 AND g.status = 'active'
       GROUP BY g.id
       ORDER BY g.created_at DESC`,
      [householdId]
    );
    return result.rows;
  } catch {
    return []; // table mungkin belum ada (migration belum jalan)
  }
}

const SYSTEM_PROMPT = `Kamu adalah asisten keuangan pribadi AI untuk Finepro, aplikasi keuangan keluarga Indonesia.

ATURAN WAJIB:
- Gunakan HANYA angka dari data JSON yang diberikan. Jangan mengarang data apapun.
- Bahasa Indonesia, nada hangat, memberdayakan, dan memotivasi — bukan menggurui.
- Ekspresif dengan emoji yang sesuai konteks: 😊 (positif/semangat), 😐 (netral/seimbang), 😟 (waspada), 💪 (dorongan), ✨ (highlight), 🏆 (pencapaian), 📊 (data), 💰 (keuangan), 🥇 (emas), 🥈 (perak), 🎯 (goal/target), ⚠️ (risiko/peringatan), 📅 (timeline), 🔄 (konsistensi), 💡 (tips), 🎉 (selamat), 📈 (tren naik), 📉 (tren turun), 🛡️ (proteksi/aman)
- JANGAN gunakan emoji untuk kondisi serius: defisit parah, utang darurat, kehilangan pendapatan.
- Maksimal 350-400 kata dalam 3-4 paragraf.
- WAJIB tutup dengan: "ℹ️ Ini prinsip umum pengelolaan keuangan, bukan nasihat keuangan berlisensi. Konsultasikan dengan perencana keuangan untuk keputusan personal."

STRUKTUR RESPONS (IKUTI URUTAN INI):

1. PEMBUKA — 1-2 kalimat apresiasi/sapaan personal berdasarkan kondisi surplus/defisit.
   - Surplus > 30%: 🎉 "Kondisi keuangan kamu bulan ini sangat sehat!" 
   - Surplus 15-30%: 😊 "Keuangan kamu cukup baik bulan ini, ada ruang untuk makin optimal."
   - Surplus 5-15%: 😐 "Keuangan kamu cukup bulan ini, tapi perlu lebih waspada."
   - Surplus 0-5%: 😟 "Keuangan kamu tipis banget bulan ini, hampir habis setiap bulannya."
   - Defisit: ⚠️ "Pengeluaran kamu lebih besar dari pemasukan bulan ini, perlu perhatian serius."

2. ANALISA SINGKAT — 2-3 kalimat baca data: sebutkan nominal surplus/defisit, kategori pengeluaran terbesar, dan apakah ada tagihan yang perlu diantisipasi. Kalau ada kategori over-budget, sebutkan dengan nada membangun.

3. REKOMENDASI ALOKASI EMAS & PERAK — berdasarkan surplus ratio:
   - Surplus > 30%: "🛡️ Alokasi yang bisa kamu pertimbangkan: 20% dana darurat, 🥇 30% emas batangan (mulai dari 0,1gr), 🥈 25% perak, 25% untuk diversifikasi ke reksadana pasar uang atau tabungan berjangka."
   - Surplus 15-30%: "💡 Rekomendasi alokasi: 25% dana darurat, 🥇 35-40% emas sebagai tabungan jangka panjang, 🥈 20% perak, sisanya tabungan likuid. Mulai dari 0,1 gram emas udah langkah besar."
   - Surplus 5-15%: "💪 Saatnya bangun kebiasaan! Sisihkan 30% untuk dana darurat dulu, lalu 🥇 50% ke emas (mulai 0,1gr per bulan), 🥈 20% ke perak. Jumlah kecil tapi konsisten jauh lebih penting daripada jumlah besar tapi cuma sekali."
   - Surplus < 5% atau defisit: "⚠️ Fokus utama kamu saat ini: evaluasi pengeluaran dulu. Terapkan 'pay yourself first' — sisihkan minimal 5-10% di awal bulan begitu pemasukan masuk. Kalau memungkinkan, alokasikan ke 🥇 emas 0,1 gram per bulan sebagai pondasi tabungan masa depan."

4. KONEKSI KE GOALS — jika user punya target tabungan aktif:
   Hitung estimasi berdasarkan harga emas/perak terkini dari data.
   Contoh format: "🎯 Target '\${goal.name}' kamu sudah \${progress}% tercapai. Dengan konsisten menyisihkan Rp\${monthly} per bulan ke emas (harga saat ini Rp\${goldPrice}/gr), kamu bisa mencapai target ini dalam ±\${months} bulan lagi."
   Kalau goal type 'money': konversikan ke estimasi gram emas dengan harga terkini.
   Kalau goal type 'gold' atau 'silver': hitung langsung berdasarkan harga dan berat.
   Kalau tidak ada goal: "💡 Belum punya target tabungan? Coba buat target pertamamu — misalnya 'Dana Haji 5gr Emas' atau 'Dana Nikah Rp50jt'. Target yang jelas bikin kamu lebih semangat menabung!"

5. KONTEKS FLUKTUASI HARGA — 1-2 kalimat berdasarkan data harga:
   "📊 Harga emas hari ini Rp\${goldPrice}/gr, perak Rp\${silverPrice}/gr. Harga emas dan perak memang fluktuatif — naik turun harian itu wajar. Yang penting konsistensi menabung, karena secara historis keduanya cenderung naik dalam jangka panjang 📈."

6. CTA PENUTUP — 1 kalimat ajakan eksekusi, pilih yang paling relevan:
   - Kalau surplus sehat + ada goal: "💰 Yuk eksekusi: tambah aset emas/perak minggu ini lewat menu 'Tambah Transaksi', atau catat kontribusi ke target tabungan kamu agar progres makin terlihat!"
   - Kalau surplus sehat + belum ada goal: "📊 Mulai dari sekarang: buat target tabungan di menu 'Goals', lalu catat transaksi tabungan emas pertamamu — 0,1 gram pun udah langkah besar!"
   - Kalau surplus tipis: "💡 Coba tracking pengeluaran harian minggu ini. Evaluasi mana yang bisa dialihkan ke tabungan emas untuk masa depan."
   - Kalau defisit: "🔄 Fokus minggu ini: kurangi pengeluaran yang tidak penting dan alihkan ke tabungan masa depan. Mulai dari langkah kecil — sisihkan Rp50rb di awal bulan ke emas."

PANDUAN TAMBAHAN:
- Pos zakat/sedekah adalah ibadah. JANGAN sebut sebagai pemborosan atau sarankan untuk dikurangi.
- Jika ada upcoming bills → ingatkan untuk siapkan dana sebelum jatuh tempo.
- Kripto HANYA disebut jika surplus > 40% DAN dana darurat + tabungan emas rutin sudah aman. Jika disebut → WAJIB disclaimer: "aset volatil high-risk, hanya alokasikan dana yang siap hilang."
- Jika user sudah konsisten menabung emas > 3 bulan (cek dari goals contribution_count) → beri apresiasi khusus 🏆.

FORMAT OUTPUT: teks polos dengan markdown ringan. Pisahkan paragraf dengan line break. JANGAN gunakan heading, list, link, atau markdown lain.

KAMU HANYA BOLEH menggunakan **bold** untuk 4 hal ini saja:
1. Nominal surplus/defisit → **Rp8.165.000**
2. Rekomendasi % emas → **30% ke emas**
3. Estimasi timeline goal → **±7 bulan lagi**
4. Kata kunci nasihat penutup → **konsistensi adalah kuncinya**

Kamu HANYA BOLEH menggunakan *italic* untuk 2-3 hal ini saja:
1. Nama goal tabungan → *Dana Pendidikan Anak*
2. Konteks fluktuasi → *harga dapat berfluktuasi sewaktu-waktu*

SELAIN 4 slot bold dan 2 slot italic di atas, JANGAN gunakan bold/italic — termasuk untuk nominal lain, persentase lain, atau kata biasa.`;

// POST /api/ai/insights — analisa on-demand, dipicu manual lewat tombol di dashboard
router.post('/insights', async (req, res) => {
  try {
    const householdId = await getUserHouseholdId(req.user.userId);
    if (!householdId) return res.status(400).json({ error: 'Belum punya household' });
    const aiConfig = await getSetting('ai');
    const quota = await getQuotaStatus(householdId, 'ai_insight');

    if (!quota.allowed) {
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
        message: `Kuota Analisa Keuangan sudah habis (${quota.used}/${quota.limit}). Upgrade paket untuk melanjutkan — ini hasil analisa terakhir Anda.`
      });
    }

    // Fetch all data sources in parallel
    const [stats, savingsGoals, metalPrices] = await Promise.all([
      computeFinancialStats(householdId),
      getActiveSavingsGoals(householdId),
      getCurrentMetalPrices().catch(() => null)
    ]);

    if (stats.insufficientData) {
      const narrative = `Hai! 👋 Data transaksi kamu baru tercatat ${stats.monthsWithData} bulan nih. Catat transaksi rutin minimal 2 bulan berturut-turut supaya Analisa Keuangan bisa baca pola pemasukan dan pengeluaran kamu dengan lebih akurat. Yuk mulai catat transaksi harian dari sekarang! 📊`;
      return res.json({ narrative, stats, rateLimited: false, remaining: quota.remaining });
    }

    if (!isAiConfigured(aiConfig)) {
      return res.status(503).json({ error: aiConfigurationMessage('Fitur Analisa Keuangan') });
    }

    // Build enriched prompt data
    const goldPrice = metalPrices?.gold?.price_per_gram || null;
    const silverPrice = metalPrices?.silver?.price_per_gram || null;
    const goldDate = metalPrices?.gold?.date || 'tidak tersedia';
    const silverDate = metalPrices?.silver?.date || 'tidak tersedia';

    const goalsSummary = savingsGoals.length > 0
      ? savingsGoals.map(g => ({
          name: g.name,
          type: g.goal_type,
          target: g.goal_type === 'money'
            ? `Rp${Number(g.target_amount).toLocaleString('id-ID')}`
            : `${Number(g.target_weight)} gram`,
          progress: `${g.progress_percent}%`,
          total_paid: g.goal_type === 'money'
            ? `Rp${Number(g.total_amount_paid).toLocaleString('id-ID')}`
            : `${Number(g.total_weight)} gram`,
          contributions: g.contribution_count,
          target_date: g.target_date || 'belum ditentukan',
        }))
      : [];

    const monthlySurplus = Number(stats.totalIncome || 0) - Number(stats.totalExpense || 0);

    // Estimate monthly savings for gold (30% of surplus or minimum)
    const monthlyForGold = monthlySurplus > 0
      ? Math.max(50000, Math.round(monthlySurplus * 0.3 / 50000) * 50000)
      : 0;

    const promptContent = [
      `📊 DATA KEUANGAN BULAN INI:`,
      `- Total pemasukan: Rp${Number(stats.totalIncome || 0).toLocaleString('id-ID')}`,
      `- Total pengeluaran: Rp${Number(stats.totalExpense || 0).toLocaleString('id-ID')}`,
      `- Surplus/Defisit: Rp${monthlySurplus.toLocaleString('id-ID')}`,
      `- Surplus ratio: ${stats.savingsRatioPercent?.thisMonth ?? '?'}% bulan ini, ${stats.savingsRatioPercent?.lastMonth ?? '?'}% bulan lalu`,
      `- Bulan tercatat: ${stats.monthsWithData} bulan`,
      `- Top kategori pengeluaran: ${(stats.topExpenseCategories || []).slice(0, 3).map(c => `${c.category} (Rp${Number(c.amount).toLocaleString('id-ID')})`).join(', ') || 'belum ada data'}`,
      ``,
      `🎯 TARGET TABUNGAN AKTIF:`,
      goalsSummary.length > 0
        ? goalsSummary.map(g => `- ${g.name} [${g.type}]: target ${g.target}, progres ${g.progress} (total terkumpul: ${g.total_paid}, ${g.contributions}x kontribusi), deadline: ${g.target_date}`).join('\n')
        : 'Belum ada target tabungan aktif.',
      ``,
      `🥇 HARGA LOGAM MULIA TERKINI:`,
      goldPrice
        ? `- Emas: Rp${Number(goldPrice).toLocaleString('id-ID')}/gram (data per ${goldDate})`
        : '- Emas: data harga belum tersedia',
      silverPrice
        ? `- Perak: Rp${Number(silverPrice).toLocaleString('id-ID')}/gram (data per ${silverDate})`
        : '- Perak: data harga belum tersedia',
      ``,
      `💡 CATATAN TAMBAHAN:`,
      monthlyForGold > 0
        ? `- Estimasi alokasi ke emas: Rp${monthlyForGold.toLocaleString('id-ID')}/bulan (±30% surplus, dibulatkan)`
        : '- Surplus terlalu kecil atau negatif — fokus penghematan dulu',
      stats.overBudgetCategories?.length > 0
        ? `- ⚠️ Kategori over-budget: ${stats.overBudgetCategories.map(c => `${c.category} (budget Rp${Number(c.budget).toLocaleString('id-ID')}, terpakai Rp${Number(c.spent).toLocaleString('id-ID')})`).join(', ')}`
        : '',
      stats.upcomingBills?.length > 0
        ? `- 📅 Tagihan mendatang: ${stats.upcomingBills.map(b => `${b.name} Rp${Number(b.amount).toLocaleString('id-ID')} (jatuh tempo ${b.due_date})`).join(', ')}`
        : '',
      stats.zakatStreakMonths > 0
        ? `- 🕌 Konsisten berzakat/sedekah ${stats.zakatStreakMonths} bulan berturut-turut — luar biasa!`
        : '',
      ``,
      `Buatkan analisa sesuai panduan sistem. Gunakan data di atas sebagai satu-satunya sumber angka.`,
    ].filter(line => line !== '').join('\n');

    const narrative = await generateChatText({
      config: aiConfig,
      maxTokens: 700,
      temperature: 0.7,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: promptContent
      }]
    });

    const finalNarrative = narrative || 'Tidak ada narasi yang dihasilkan.';

    await recordAiUsage({
      householdId,
      userId: req.user.userId,
      feature: 'ai_insight',
      source: 'web',
      usedAi: true,
      provider: aiConfig.provider || null,
      model: aiConfig.sumopod_model || aiConfig.anthropic_model || aiConfig.model || null,
      metadata: { status: 'success' },
    });

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
      remaining: Math.max(0, quota.remaining - 1)
    });
  } catch (err) {
    console.error('AI insight error:', err);
    res.status(500).json({ error: 'Gagal membuat analisa keuangan' });
  }
});

export default router;
