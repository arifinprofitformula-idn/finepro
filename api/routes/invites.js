import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendMail } from '../services/mailer.js';

const router = Router();
router.use(authMiddleware);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function appBaseUrl(req) {
  const configured = (process.env.APP_BASE_URL || '').replace(/\/$/, '');
  if (configured) return configured;

  const host = req.get('host');
  if (!host) return '';
  const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
  return `${proto}://${host}`.replace(/\/$/, '');
}

function formatIndoDate(value) {
  if (!value) return '7 hari sejak undangan dibuat';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

function inviteEmailTemplate({ inviterName, householdName, invitedEmail, inviteLink, expiresAt }) {
  const safeInviterName = escapeHtml(inviterName || 'Pemilik household');
  const safeHouseholdName = escapeHtml(householdName || 'Household FinePro');
  const safeInvitedEmail = escapeHtml(invitedEmail);
  const safeInviteLink = escapeHtml(inviteLink);
  const safeExpiresAt = escapeHtml(formatIndoDate(expiresAt));

  return `
<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Undangan Household FinePro</title>
  </head>
  <body style="margin:0;background:#f6fbff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1c2230;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6fbff;padding:28px 14px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #dfe8f1;border-radius:24px;overflow:hidden;box-shadow:0 20px 55px rgba(49,77,119,0.14);">
            <tr>
              <td style="padding:26px 24px;background:linear-gradient(135deg,#0f1f3d 0%,#6f55f2 100%);">
                <img src="https://finepro.my.id/images/fine-pro-header.png" alt="FinePro" width="240" style="display:block;max-width:240px;width:100%;height:auto;margin:0 0 18px 0;" />
                <h1 style="margin:18px 0 0;color:#ffffff;font-size:24px;line-height:1.25;">Kamu diundang bergabung ke FinePro</h1>
                <p style="margin:8px 0 0;color:rgba(255,255,255,0.82);font-size:14px;line-height:1.6;">Kelola catatan keuangan bersama dalam satu household.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 24px;">
                <p style="margin:0 0 14px;font-size:15px;line-height:1.7;">Halo,</p>
                <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#3f4657;">
                  <strong>${safeInviterName}</strong> mengundang kamu untuk bergabung ke household <strong>${safeHouseholdName}</strong> di FinePro.
                </p>
                <div style="background:#efeaff;border:1px solid rgba(111,85,242,0.18);border-radius:16px;padding:14px 16px;margin:0 0 20px;">
                  <p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:#3f2ca8;">Gunakan email ini saat login atau daftar:</p>
                  <p style="margin:0;font-size:15px;font-weight:800;color:#0f1f3d;word-break:break-all;">${safeInvitedEmail}</p>
                  <p style="margin:10px 0 0;font-size:12px;line-height:1.6;color:#6b5fc7;">Undangan berlaku sampai ${safeExpiresAt}.</p>
                </div>
                <p style="margin:26px 0;text-align:center;">
                  <a href="${safeInviteLink}" style="display:inline-block;background:#6f55f2;color:#ffffff;text-decoration:none;border-radius:999px;padding:14px 22px;font-size:14px;font-weight:800;box-shadow:0 14px 28px rgba(111,85,242,0.26);">Buka FinePro</a>
                </p>
                <p style="margin:0 0 8px;font-size:13px;line-height:1.65;color:#6b7280;">Setelah masuk, buka menu Akun atau halaman onboarding untuk menerima undangan.</p>
                <p style="margin:0;font-size:12px;line-height:1.6;word-break:break-all;color:#6b7280;">Jika tombol tidak bisa dibuka, salin tautan ini: ${safeInviteLink}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px;background:#f9f9f8;border-top:1px solid #dfe8f1;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">Jika kamu tidak mengenal pengirim undangan ini, abaikan email ini.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function getOwnerHouseholdId(userId) {
  const result = await pool.query(
    `SELECT household_id FROM household_members WHERE user_id = $1 AND role = 'owner' LIMIT 1`,
    [userId]
  );
  return result.rows[0]?.household_id || null;
}

async function getOwnerContext(userId, householdId) {
  const context = await pool.query(
    `SELECT h.name AS household_name, u.name AS inviter_name, u.email AS inviter_email
     FROM households h
     JOIN users u ON u.id = $2
     WHERE h.id = $1`,
    [householdId, userId]
  );
  return context.rows[0] || {};
}

async function sendInviteEmail({ req, email, invite, context }) {
  const baseUrl = appBaseUrl(req);
  if (!baseUrl) throw new Error('APP_BASE_URL belum tersedia untuk membuat tautan undangan');
  const inviteLink = `${baseUrl}/?invite=1&email=${encodeURIComponent(email)}`;
  const inviterName = context.inviter_name || context.inviter_email;
  const householdName = context.household_name;
  await sendMail({
    to: email,
    subject: `${inviterName || 'FinePro'} mengundang kamu ke household FinePro`,
    html: inviteEmailTemplate({
      inviterName,
      householdName,
      invitedEmail: email,
      inviteLink,
      expiresAt: invite.expires_at,
    }),
  });
}

async function getOwnerInvite(userId, inviteId) {
  const householdId = await getOwnerHouseholdId(userId);
  if (!householdId) return { householdId: null, invite: null };

  const result = await pool.query(
    `SELECT i.*, h.name AS household_name
     FROM household_invites i
     JOIN households h ON h.id = i.household_id
     WHERE i.id = $1 AND i.household_id = $2`,
    [inviteId, householdId]
  );
  return { householdId, invite: result.rows[0] || null };
}

// POST /api/invites — owner household mengundang anggota baru lewat email
router.post('/', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email || !EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: 'Email undangan tidak valid' });
    }

    const householdId = await getOwnerHouseholdId(req.user.userId);
    if (!householdId) {
      return res.status(403).json({ error: 'Hanya pemilik household yang bisa mengundang anggota' });
    }

    const existingMember = await pool.query(
      `SELECT 1
       FROM household_members hm
       JOIN users u ON u.id = hm.user_id
       WHERE hm.household_id = $1 AND lower(u.email) = lower($2)
       LIMIT 1`,
      [householdId, email]
    );
    if (existingMember.rows.length > 0) {
      return res.status(409).json({ error: 'Email ini sudah menjadi anggota household' });
    }

    const existingInvite = await pool.query(
      `SELECT *
       FROM household_invites
       WHERE household_id = $1
         AND lower(invited_email) = lower($2)
         AND status = 'pending'
         AND expires_at > now()
       ORDER BY created_at DESC
       LIMIT 1`,
      [householdId, email]
    );
    if (existingInvite.rows[0]) {
      return res.status(409).json({ error: 'Undangan aktif untuk email ini sudah ada. Gunakan Kirim Ulang Email.' });
    }

    const context = await getOwnerContext(req.user.userId, householdId);

    const result = await pool.query(
      `INSERT INTO household_invites (household_id, invited_email, invited_by)
       VALUES ($1, $2, $3) RETURNING *`,
      [householdId, email, req.user.userId]
    );
    const invite = result.rows[0];

    let emailSent = false;
    let emailError = null;
    try {
      await sendInviteEmail({ req, email, invite, context });
      emailSent = true;
    } catch (mailErr) {
      emailError = mailErr.message;
      console.warn('Invite email failed:', mailErr);
    }

    res.status(201).json({ invite, emailSent, emailError });
  } catch (err) {
    console.error('Create invite error:', err);
    res.status(500).json({ error: 'Gagal membuat undangan' });
  }
});

// GET /api/invites/sent — undangan yang dibuat owner household
router.get('/sent', async (req, res) => {
  try {
    const householdId = await getOwnerHouseholdId(req.user.userId);
    if (!householdId) {
      return res.status(403).json({ error: 'Hanya pemilik household yang bisa melihat undangan terkirim' });
    }

    await pool.query(
      `UPDATE household_invites
       SET status = 'expired'
       WHERE household_id = $1 AND status = 'pending' AND expires_at <= now()`,
      [householdId]
    );

    const result = await pool.query(
      `SELECT i.*, h.name AS household_name, u.name AS invited_user_name
       FROM household_invites i
       JOIN households h ON h.id = i.household_id
       LEFT JOIN users u ON lower(u.email) = lower(i.invited_email)
       WHERE i.household_id = $1
       ORDER BY i.created_at DESC
       LIMIT 50`,
      [householdId]
    );
    res.json({ invites: result.rows });
  } catch (err) {
    console.error('List sent invites error:', err);
    res.status(500).json({ error: 'Gagal mengambil undangan terkirim' });
  }
});

// POST /api/invites/:id/resend — kirim ulang email untuk undangan pending
router.post('/:id/resend', async (req, res) => {
  try {
    const { householdId, invite } = await getOwnerInvite(req.user.userId, req.params.id);
    if (!householdId) return res.status(403).json({ error: 'Hanya pemilik household yang bisa mengirim ulang undangan' });
    if (!invite) return res.status(404).json({ error: 'Undangan tidak ditemukan' });
    if (invite.status !== 'pending' || new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Hanya undangan pending yang masih berlaku yang bisa dikirim ulang' });
    }

    const context = await getOwnerContext(req.user.userId, householdId);
    await sendInviteEmail({ req, email: invite.invited_email, invite, context });
    res.json({ sent: true });
  } catch (err) {
    console.error('Resend invite error:', err);
    res.status(500).json({ error: err.message || 'Gagal mengirim ulang undangan' });
  }
});

// POST /api/invites/:id/cancel — batalkan undangan pending
router.post('/:id/cancel', async (req, res) => {
  try {
    const { householdId, invite } = await getOwnerInvite(req.user.userId, req.params.id);
    if (!householdId) return res.status(403).json({ error: 'Hanya pemilik household yang bisa membatalkan undangan' });
    if (!invite) return res.status(404).json({ error: 'Undangan tidak ditemukan' });
    if (invite.status !== 'pending') {
      return res.status(400).json({ error: 'Hanya undangan pending yang bisa dibatalkan' });
    }

    const result = await pool.query(
      `UPDATE household_invites SET status = 'cancelled' WHERE id = $1 RETURNING *`,
      [invite.id]
    );
    res.json({ invite: result.rows[0] });
  } catch (err) {
    console.error('Cancel invite error:', err);
    res.status(500).json({ error: 'Gagal membatalkan undangan' });
  }
});

// GET /api/invites/mine — undangan pending untuk email user yang sedang login
router.get('/mine', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, h.name as household_name
       FROM household_invites i
       JOIN households h ON h.id = i.household_id
       WHERE lower(i.invited_email) = lower($1)
         AND i.status = 'pending'
         AND i.expires_at > now()
       ORDER BY i.created_at DESC`,
      [req.user.email]
    );
    res.json({ invites: result.rows });
  } catch (err) {
    console.error('List invites error:', err);
    res.status(500).json({ error: 'Gagal mengambil undangan' });
  }
});

// POST /api/invites/:id/accept — terima undangan, gabung ke household
router.post('/:id/accept', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const inviteResult = await client.query(
      `SELECT * FROM household_invites WHERE id = $1 FOR UPDATE`,
      [req.params.id]
    );
    const invite = inviteResult.rows[0];

    if (!invite) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Undangan tidak ditemukan' });
    }
    if (invite.status !== 'pending' || new Date(invite.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Undangan sudah tidak berlaku' });
    }
    if (invite.invited_email.toLowerCase() !== req.user.email.toLowerCase()) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Undangan ini bukan untuk akun Anda' });
    }

    const existing = await client.query(
      `SELECT household_id FROM household_members WHERE user_id = $1 LIMIT 1`,
      [req.user.userId]
    );
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Anda sudah tergabung di household lain' });
    }

    await client.query(
      `INSERT INTO household_members (household_id, user_id, role) VALUES ($1, $2, 'member')`,
      [invite.household_id, req.user.userId]
    );
    await client.query(
      `UPDATE household_invites SET status = 'accepted' WHERE id = $1`,
      [invite.id]
    );

    await client.query('COMMIT');
    res.json({ joined: true, householdId: invite.household_id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Accept invite error:', err);
    res.status(500).json({ error: 'Gagal menerima undangan' });
  } finally {
    client.release();
  }
});

export default router;
