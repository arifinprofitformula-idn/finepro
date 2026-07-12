// api/services/mailer.js
// Pengirim email transaksional bersama, dipakai monthlyReport.js dan
// forgot-password (routes/auth.js) — satu titik integrasi ke Mailketing API
// (https://mailketing.co.id/docs/send-email-via-api/).

import { getSetting } from './appSettings.js';

const MAILKETING_API_URL = 'https://api.mailketing.co.id/api/v1/send';

function redactEmail(email = '') {
  const [name, domain] = String(email).split('@');
  if (!name || !domain) return email ? '***' : '';
  return `${name.slice(0, 2)}***@${domain}`;
}

function mailketingStatus(data) {
  return String(data?.status || '').toLowerCase();
}

export async function sendMail({ to, subject, html }) {
  const mailketing = await getSetting('mailketing');
  const apiToken = mailketing.api_token;
  const fromEmail = mailketing.from_email;
  const fromName = mailketing.from_name || 'Finepro';

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

  const responseText = await res.text();
  let data = null;
  try {
    data = responseText ? JSON.parse(responseText) : null;
  } catch {
    data = null;
  }

  if (!res.ok || !data || mailketingStatus(data) !== 'success') {
    const reason = data?.response || responseText || res.statusText || `HTTP ${res.status}`;
    console.error('[mailer] Mailketing failed', {
      statusCode: res.status,
      to: redactEmail(to),
      subject,
      reason,
    });
    throw new Error(`Mailketing gagal: ${reason}`);
  }

  console.info('[mailer] Mailketing sent', {
    to: redactEmail(to),
    subject,
    response: data.response || 'Mail Sent',
  });
}
