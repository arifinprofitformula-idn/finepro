// api/services/mailer.js
// Pengirim email transaksional bersama, dipakai monthlyReport.js dan
// forgot-password (routes/auth.js) — satu titik integrasi ke Mailketing API
// (https://mailketing.co.id/docs/send-email-via-api/).

import { getSetting } from './appSettings.js';

const MAILKETING_API_URL = 'https://api.mailketing.co.id/api/v1/send';

export async function sendMail({ to, subject, html }) {
  const mailketing = await getSetting('mailketing');
  const apiToken = mailketing.api_token;
  const fromEmail = mailketing.from_email;
  const fromName = mailketing.from_name || 'Keuangan Keluarga';

  if (!mailketing.enabled || !apiToken || apiToken === 'isi-api-token-mailketing' || !fromEmail || fromEmail === 'isi-email-pengirim-terverifikasi') {
    throw new Error('Mailketing belum aktif atau belum lengkap di Admin Console');
  }

  const body = new URLSearchParams({
    api_token: apiToken,
    from_name: fromName,
    from_email: fromEmail,
    recipient: to,
    subject,
    content: html,
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
