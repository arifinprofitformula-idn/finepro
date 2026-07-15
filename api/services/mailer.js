// api/services/mailer.js
// Pengirim email transaksional bersama, dipakai monthlyReport.js dan
// forgot-password (routes/auth.js) — satu titik integrasi ke Mailketing API
// (https://mailketing.co.id/docs/send-email-via-api/).

import { getSetting } from './appSettings.js';

const MAILKETING_API_URL = 'https://api.mailketing.co.id/api/v1/send';
const MAILKETING_ADD_SUBSCRIBER_URL = 'https://api.mailketing.co.id/api/v1/addsubtolist';
const MAILKETING_VIEW_LIST_URL = 'https://api.mailketing.co.id/api/v1/viewlist';

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

export async function getMailketingLists(settingsOverride = {}) {
  const override = { ...(settingsOverride || {}) };
  if (override.api_token === '') delete override.api_token;
  const mailketing = { ...(await getSetting('mailketing')), ...override };
  const apiToken = mailketing.api_token;

  if (!apiToken || apiToken === 'isi-api-token-mailketing') {
    throw new Error('API Token Mailketing belum diisi');
  }

  const body = new URLSearchParams({ api_token: apiToken });
  const res = await fetch(MAILKETING_VIEW_LIST_URL, {
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

  if (!res.ok || !data || mailketingStatus(data) !== 'success' || !Array.isArray(data.lists)) {
    const reason = data?.response || responseText || res.statusText || `HTTP ${res.status}`;
    console.error('[mailer] Mailketing viewlist failed', {
      statusCode: res.status,
      reason,
    });
    throw new Error(`Mailketing viewlist gagal: ${reason}`);
  }

  return data.lists.map((item) => ({
    list_id: String(item.list_id ?? ''),
    list_name: String(item.list_name ?? ''),
  })).filter((item) => item.list_id);
}

// Tambahkan kontak ke list Mailketing (mis. saat registrasi baru, atau saat
// trial berubah jadi berlangganan). Default ke list_id (list trial/registrasi);
// kirim listId eksplisit untuk menarget list lain (mis. paid_list_id). Kalau
// list tujuan belum diisi di Admin Console, ini di-skip diam-diam — admin
// bisa mengisinya belakangan tanpa perlu perubahan kode.
export async function addSubscriberToList({ email, name, listId }) {
  const mailketing = await getSetting('mailketing');
  const apiToken = mailketing.api_token;
  const targetListId = listId || mailketing.list_id;

  if (!mailketing.enabled || !apiToken || !targetListId) {
    return;
  }

  const [firstName, ...rest] = String(name || '').trim().split(/\s+/).filter(Boolean);
  const body = new URLSearchParams({
    api_token: apiToken,
    list_id: targetListId,
    email,
    first_name: firstName || '',
    last_name: rest.join(' '),
  });

  const res = await fetch(MAILKETING_ADD_SUBSCRIBER_URL, {
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
    console.error('[mailer] Mailketing addsubtolist failed', {
      statusCode: res.status,
      to: redactEmail(email),
      reason,
    });
    throw new Error(`Mailketing addsubtolist gagal: ${reason}`);
  }

  console.info('[mailer] Mailketing subscriber added', { to: redactEmail(email), listId: targetListId });
}
