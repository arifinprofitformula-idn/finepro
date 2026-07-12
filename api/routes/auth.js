import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { OAuth2Client } from 'google-auth-library';
import pool from '../db.js';
import { generateToken, authMiddleware, adminRoleForEmail } from '../middleware/auth.js';
import { sendMail } from '../services/mailer.js';

const router = Router();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan, coba lagi beberapa menit lagi' },
});

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 jam
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value) {
  return EMAIL_PATTERN.test(normalizeEmail(value));
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
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

function resetPasswordEmailTemplate({ name, resetLink }) {
  const safeName = escapeHtml(name || 'Sahabat Finepro');
  const safeResetLink = escapeHtml(resetLink);

  return `
<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Reset Password Finepro</title>
  </head>
  <body style="margin:0;background:#f6fbff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1c2230;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6fbff;padding:28px 14px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #dfe8f1;border-radius:24px;overflow:hidden;box-shadow:0 20px 55px rgba(49,77,119,0.14);">
            <tr>
              <td style="padding:26px 24px;background:linear-gradient(135deg,#0f1f3d 0%,#6f55f2 100%);">
                <img src="https://finepro.my.id/images/fine-pro-header.png" alt="Finepro" width="240" style="display:block;max-width:240px;width:100%;height:auto;margin:0 0 18px 0;" />
                <h1 style="margin:18px 0 0;color:#ffffff;font-size:24px;line-height:1.25;">Atur ulang password Finepro</h1>
                <p style="margin:8px 0 0;color:rgba(255,255,255,0.82);font-size:14px;line-height:1.6;">Kami bantu kamu masuk kembali dengan aman.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 24px;">
                <p style="margin:0 0 14px;font-size:15px;line-height:1.7;">Halo <strong>${safeName}</strong>,</p>
                <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#3f4657;">Kami menerima permintaan untuk membuat password baru. Klik tombol di bawah ini untuk melanjutkan. Tautan berlaku selama <strong>1 jam</strong>.</p>
                <p style="margin:26px 0;text-align:center;">
                  <a href="${safeResetLink}" style="display:inline-block;background:#6f55f2;color:#ffffff;text-decoration:none;border-radius:999px;padding:14px 22px;font-size:14px;font-weight:800;box-shadow:0 14px 28px rgba(111,85,242,0.26);">Buat Password Baru</a>
                </p>
                <div style="background:#efeaff;border:1px solid rgba(111,85,242,0.18);border-radius:16px;padding:14px 16px;margin:0 0 18px;">
                  <p style="margin:0;font-size:13px;line-height:1.65;color:#3f2ca8;">Jika tombol tidak bisa dibuka, salin tautan ini ke browser:</p>
                  <p style="margin:8px 0 0;font-size:12px;line-height:1.6;word-break:break-all;color:#0f1f3d;">${safeResetLink}</p>
                </div>
                <p style="margin:0;font-size:13px;line-height:1.7;color:#6b7280;">Jika kamu tidak meminta reset password, abaikan email ini. Password lama tetap berlaku selama tautan ini tidak digunakan.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px;background:#f9f9f8;border-top:1px solid #dfe8f1;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">Finepro menjaga data keuanganmu tetap rapi, tenang, dan mudah dipahami.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AVATAR_DIR = path.join(__dirname, '..', 'uploads', 'avatars');
mkdirSync(AVATAR_DIR, { recursive: true });

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, AVATAR_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${req.user.userId}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (!/^image\/(png|jpe?g|webp)$/.test(file.mimetype)) {
      return cb(new Error('Format foto harus PNG, JPG, atau WEBP'));
    }
    cb(null, true);
  },
});

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { password, name } = req.body;
    const email = normalizeEmail(req.body.email);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan password wajib diisi' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Format email tidak valid' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password minimal 6 karakter' });
    }

    // Cek apakah email sudah terdaftar
    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email sudah terdaftar' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, avatar_url, role, created_at',
      [email, passwordHash, name || null]
    );

    const user = { ...result.rows[0], role: adminRoleForEmail(result.rows[0].email, result.rows[0].role), has_password: true };
    const token = generateToken(user);

    res.status(201).json({ user, token });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Gagal mendaftar' });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { password } = req.body;
    const email = normalizeEmail(req.body.email);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan password wajib diisi' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Format email tidak valid' });
    }

    const result = await pool.query(
      'SELECT id, email, password_hash, name, avatar_url, role, created_at FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Email atau password salah' });
    }

    const user = result.rows[0];
    if (!user.password_hash) {
      return res.status(401).json({ error: 'Akun ini terdaftar via Google. Silakan masuk dengan tombol "Lanjutkan dengan Google"' });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Email atau password salah' });
    }

    const token = generateToken(user);
    const { password_hash, ...userWithoutPasswordRaw } = user;
    const userWithoutPassword = {
      ...userWithoutPasswordRaw,
      role: adminRoleForEmail(user.email, user.role),
      has_password: Boolean(password_hash),
    };

    res.json({ user: userWithoutPassword, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Gagal login' });
  }
});

// POST /api/auth/google — login/daftar via Google Identity Services ID token
router.post('/google', authLimiter, async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'idToken wajib diisi' });
    }
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: 'Login Google belum dikonfigurasi di server' });
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({ error: 'Token Google tidak valid' });
    }

    const { sub: googleId, email: googleEmail, name, email_verified: emailVerified } = payload;
    const email = normalizeEmail(googleEmail);
    if (!email || !emailVerified) {
      return res.status(401).json({ error: 'Email Google belum terverifikasi' });
    }

    let result = await pool.query(
      'SELECT id, email, name, avatar_url, role, created_at, (password_hash IS NOT NULL) AS has_password FROM users WHERE google_id = $1',
      [googleId]
    );

    if (result.rows.length === 0) {
      // Belum ada akun dengan google_id ini — cek apakah email sudah terdaftar (akun lokal), kalau ada tautkan.
      const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
      if (existing.rows.length > 0) {
        result = await pool.query(
          `UPDATE users SET google_id = $1, provider = CASE WHEN password_hash IS NULL THEN 'google' ELSE provider END
           WHERE id = $2 RETURNING id, email, name, avatar_url, role, created_at, (password_hash IS NOT NULL) AS has_password`,
          [googleId, existing.rows[0].id]
        );
      } else {
        result = await pool.query(
          `INSERT INTO users (email, name, google_id, provider)
           VALUES ($1, $2, $3, 'google')
           RETURNING id, email, name, avatar_url, role, created_at, (password_hash IS NOT NULL) AS has_password`,
          [email, name || null, googleId]
        );
      }
    }

    const user = { ...result.rows[0], role: adminRoleForEmail(result.rows[0].email, result.rows[0].role) };
    const token = generateToken(user);

    res.json({ user, token });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ error: 'Gagal masuk dengan Google' });
  }
});

// POST /api/auth/forgot-password — kirim link reset password via email
router.post('/forgot-password', authLimiter, async (req, res) => {
  const genericResponse = {
    message: 'Permintaan reset diproses. Jika email tersebut terdaftar, tautan reset password sudah dikirim. Cek inbox dan folder spam.'
  };
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) {
      return res.status(400).json({ error: 'Email wajib diisi' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Format email tidak valid' });
    }

    const result = await pool.query('SELECT id, name FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (result.rows.length === 0) {
      // Jangan bocorkan apakah email terdaftar atau tidak.
      return res.json(genericResponse);
    }

    const user = result.rows[0];
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, expiresAt]
    );

    const baseUrl = appBaseUrl(req);
    if (!baseUrl) {
      throw new Error('APP_BASE_URL belum diisi dan host request tidak tersedia untuk membuat tautan reset password');
    }
    const resetLink = `${baseUrl}/?reset_token=${rawToken}`;

    await sendMail({
      to: email,
      subject: 'Atur Ulang Password Finepro',
      html: resetPasswordEmailTemplate({ name: user.name, resetLink }),
    });

    res.json(genericResponse);
  } catch (err) {
    console.error('Forgot password error:', err);
    // Tetap balas generik supaya tidak membocorkan info ke pihak luar, tapi log detail di server.
    res.json(genericResponse);
  }
});

// POST /api/auth/reset-password — set password baru pakai token dari email
router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token dan password wajib diisi' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password minimal 6 karakter' });
    }

    const tokenHash = hashResetToken(token);
    const result = await pool.query(
      `SELECT id, user_id, expires_at, used_at FROM password_reset_tokens
       WHERE token_hash = $1`,
      [tokenHash]
    );

    const record = result.rows[0];
    if (!record || record.used_at || new Date(record.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Token reset password tidak valid atau sudah kadaluarsa' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, record.user_id]);
    await pool.query('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [record.id]);

    res.json({ message: 'Password berhasil diperbarui' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Gagal mereset password' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, avatar_url, role, created_at, telegram_id, telegram_username, (password_hash IS NOT NULL) AS has_password FROM users WHERE id = $1',
      [req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User tidak ditemukan' });
    }
    const user = result.rows[0];
    res.json({ user: { ...user, role: adminRoleForEmail(user.email, user.role) } });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data user' });
  }
});

// PUT /api/auth/profile — update profil dasar user login
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    const displayName = String(name || '').trim();
    if (!displayName) {
      return res.status(400).json({ error: 'Nama pengguna wajib diisi' });
    }
    if (displayName.length > 80) {
      return res.status(400).json({ error: 'Nama pengguna maksimal 80 karakter' });
    }

    const result = await pool.query(
      `UPDATE users SET name = $1 WHERE id = $2
       RETURNING id, email, name, avatar_url, role, created_at, telegram_id, telegram_username, (password_hash IS NOT NULL) AS has_password`,
      [displayName, req.user.userId]
    );
    const user = result.rows[0];
    res.json({ user: { ...user, role: adminRoleForEmail(user.email, user.role) } });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Gagal menyimpan profil' });
  }
});

// PUT /api/auth/change-password — ganti password (atau buat password baru untuk akun Google-only)
router.put('/change-password', authLimiter, authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
    }

    const result = await pool.query('SELECT id, email, name, password_hash FROM users WHERE id = $1', [req.user.userId]);
    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User tidak ditemukan' });
    }

    if (user.password_hash) {
      if (!oldPassword) {
        return res.status(400).json({ error: 'Password lama wajib diisi' });
      }
      const valid = await bcrypt.compare(oldPassword, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Password lama salah' });
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, user.id]);

    // Notifikasi email — kirim best-effort, jangan gagalkan request kalau Mailketing bermasalah.
    sendMail({
      to: user.email,
      subject: 'Password Anda Telah Diubah — Keuangan Keluarga',
      html: `
        <p>Halo ${user.name || ''},</p>
        <p>Password akun Keuangan Keluarga Anda (${user.email}) baru saja diubah.</p>
        <p>Jika Anda tidak melakukan perubahan ini, segera gunakan fitur <strong>Lupa Password</strong> di halaman masuk untuk mengamankan akun Anda.</p>
      `,
    }).catch((err) => console.error('Gagal kirim notifikasi ganti password:', err));

    res.json({ has_password: true, message: user.password_hash ? 'Password berhasil diubah' : 'Password berhasil dibuat' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Gagal mengubah password' });
  }
});

// POST /api/auth/avatar — upload/ganti foto profil
router.post('/avatar', authMiddleware, (req, res) => {
  avatarUpload.single('avatar')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Gagal mengunggah foto' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'File foto wajib diisi' });
    }

    try {
      const avatarUrl = `/api/uploads/avatars/${req.file.filename}`;
      const result = await pool.query(
        'UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING id, email, name, avatar_url, role, created_at, (password_hash IS NOT NULL) AS has_password',
        [avatarUrl, req.user.userId]
      );
      const user = result.rows[0];
      res.json({ user: { ...user, role: adminRoleForEmail(user.email, user.role) } });
    } catch (err) {
      console.error('Update avatar error:', err);
      res.status(500).json({ error: 'Gagal menyimpan foto profil' });
    }
  });
});

export default router;
