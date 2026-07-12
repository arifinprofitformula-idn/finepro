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

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
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
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan password wajib diisi' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password minimal 6 karakter' });
    }

    // Cek apakah email sudah terdaftar
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan password wajib diisi' });
    }

    const result = await pool.query(
      'SELECT id, email, password_hash, name, avatar_url, role, created_at FROM users WHERE email = $1',
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

    const { sub: googleId, email, name, email_verified: emailVerified } = payload;
    if (!email || !emailVerified) {
      return res.status(401).json({ error: 'Email Google belum terverifikasi' });
    }

    let result = await pool.query(
      'SELECT id, email, name, avatar_url, role, created_at, (password_hash IS NOT NULL) AS has_password FROM users WHERE google_id = $1',
      [googleId]
    );

    if (result.rows.length === 0) {
      // Belum ada akun dengan google_id ini — cek apakah email sudah terdaftar (akun lokal), kalau ada tautkan.
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
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
  const genericResponse = { message: 'Jika email terdaftar, tautan reset password telah dikirim' };
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email wajib diisi' });
    }

    const result = await pool.query('SELECT id, name FROM users WHERE email = $1', [email]);
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

    const baseUrl = (process.env.APP_BASE_URL || '').replace(/\/$/, '');
    const resetLink = `${baseUrl}/?reset_token=${rawToken}`;

    await sendMail({
      to: email,
      subject: 'Reset Password — Keuangan Keluarga',
      html: `
        <p>Halo ${user.name || ''},</p>
        <p>Kami menerima permintaan reset password untuk akun Anda. Klik tautan berikut untuk membuat password baru (berlaku 1 jam):</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>Jika Anda tidak meminta reset password, abaikan email ini.</p>
      `,
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
