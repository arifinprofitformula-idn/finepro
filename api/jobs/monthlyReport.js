// api/jobs/monthlyReport.js
// Job terpisah dari Express server — dijalankan oleh cron OS di VPS tiap
// awal bulan (lihat contoh crontab di bawah), bukan Supabase Edge Function.
//
// Alur: ambil ringkasan transaksi bulan sebelumnya per household, lalu
// kirim email ringkasan ke pemilik household lewat Mailketing API
// (https://mailketing.co.id/docs/send-email-via-api/).
//
// SEBELUM DIPASANG DI CRON: isi MAILKETING_API_TOKEN dan
// MAILKETING_FROM_EMAIL (harus alamat pengirim yang sudah terverifikasi
// di akun Mailketing) di .env — masih placeholder saat ini.
//
// Jalankan manual untuk tes:
//   node jobs/monthlyReport.js

import pool from '../db.js';
import { getSetting } from '../services/appSettings.js';

const MAILKETING_API_URL = 'https://api.mailketing.co.id/api/v1/send';

function previousMonthLabel() {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return prev.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

function buildReportContent(summary, monthLabel) {
  const income = Number(summary.income);
  const expense = Number(summary.expense);
  const balance = income - expense;
  const fmt = (n) => 'Rp ' + Math.round(n).toLocaleString('id-ID');

  return `
    <p>Halo ${summary.owner_name || summary.owner_email},</p>
    <p>Berikut ringkasan keuangan <strong>${summary.household_name}</strong> untuk bulan <strong>${monthLabel}</strong>:</p>
    <ul>
      <li>Total Pemasukan: ${fmt(income)}</li>
      <li>Total Pengeluaran: ${fmt(expense)}</li>
      <li>Saldo Bulan Ini: ${fmt(balance)}</li>
      <li>Jumlah Transaksi: ${summary.transaction_count}</li>
    </ul>
    <p>Login ke aplikasi Keuangan Keluarga untuk detail lengkap.</p>
  `.trim();
}

async function getPreviousMonthSummaries() {
  const result = await pool.query(`
    SELECT
      h.id as household_id,
      h.name as household_name,
      h.household_type,
      u.email as owner_email,
      u.name as owner_name,
      COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as expense,
      COUNT(t.id) as transaction_count
    FROM households h
    JOIN users u ON u.id = h.owner_id
    LEFT JOIN transactions t
      ON t.household_id = h.id
      AND t.date >= date_trunc('month', CURRENT_DATE - interval '1 month')
      AND t.date < date_trunc('month', CURRENT_DATE)
    GROUP BY h.id, h.name, h.household_type, u.email, u.name
  `);
  return result.rows;
}

async function sendReportEmail(summary) {
  const mailketing = await getSetting('mailketing');
  const apiToken = mailketing.api_token;
  const fromEmail = mailketing.from_email;
  const fromName = mailketing.from_name || 'Keuangan Keluarga';

  if (!mailketing.enabled || !apiToken || apiToken === 'isi-api-token-mailketing' || !fromEmail || fromEmail === 'isi-email-pengirim-terverifikasi') {
    throw new Error('Mailketing belum aktif atau belum lengkap di Admin Console');
  }

  const monthLabel = previousMonthLabel();
  const body = new URLSearchParams({
    api_token: apiToken,
    from_name: fromName,
    from_email: fromEmail,
    recipient: summary.owner_email,
    subject: `Laporan Keuangan ${summary.household_name} — ${monthLabel}`,
    content: buildReportContent(summary, monthLabel),
  });

  const res = await fetch(MAILKETING_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.status !== 'success') {
    throw new Error(`Mailketing gagal: ${data?.response || res.statusText}`);
  }
}

async function run() {
  const summaries = await getPreviousMonthSummaries();
  console.log(`[monthlyReport] ${summaries.length} household ditemukan untuk laporan bulan lalu.`);

  let ok = 0;
  let failed = 0;

  for (const summary of summaries) {
    try {
      await sendReportEmail(summary);
      console.log(`[monthlyReport] OK  -> ${summary.household_name} (${summary.owner_email})`);
      ok++;
    } catch (err) {
      console.error(`[monthlyReport] GAGAL -> ${summary.household_name} (${summary.owner_email}): ${err.message}`);
      failed++;
    }
  }

  console.log(`[monthlyReport] Selesai. Berhasil: ${ok}, Gagal: ${failed}.`);
}

run()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error('[monthlyReport] Job gagal total:', err);
    await pool.end();
    process.exit(1);
  });

// ============================================================
// Contoh crontab (jalan tiap tanggal 1 jam 07:00 waktu server VPS):
//
//   0 7 1 * * cd /var/www/keuangan-api && /usr/bin/node jobs/monthlyReport.js >> /var/log/keuangan-monthly-report.log 2>&1
//
// Pasang dengan: crontab -e (sebagai user yang menjalankan api/, bukan root)
// Sesuaikan path /var/www/keuangan-api dan /usr/bin/node dengan lokasi
// sebenarnya di VPS (cek `which node`).
// ============================================================
