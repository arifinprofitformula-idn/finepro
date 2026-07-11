import jwt from 'jsonwebtoken';
import pool from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'keuangan-keluarga-secret-change-in-production';

function listFromEnv(name) {
  return (process.env[name] || '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

export function adminRoleForEmail(email, dbRole = 'user') {
  const normalized = String(email || '').toLowerCase();
  if (listFromEnv('ADMIN_SUPER_EMAILS').includes(normalized)) return 'super_admin';
  if (listFromEnv('ADMIN_EMAILS').includes(normalized)) return dbRole === 'super_admin' ? 'super_admin' : 'admin';
  return dbRole || 'user';
}

// Middleware: verifikasi JWT token dari header Authorization
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token tidak ditemukan' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { userId, email }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token tidak valid atau kadaluarsa' });
  }
}

export async function adminMiddleware(req, res, next) {
  try {
    const result = await pool.query('SELECT id, email, role FROM users WHERE id = $1', [req.user.userId]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'User tidak ditemukan' });

    const role = adminRoleForEmail(user.email, user.role);
    if (!['admin', 'super_admin'].includes(role)) {
      return res.status(403).json({ error: 'Akses admin diperlukan' });
    }

    req.admin = { ...user, role };
    next();
  } catch (err) {
    console.error('Admin middleware error:', err);
    res.status(500).json({ error: 'Gagal memverifikasi akses admin' });
  }
}

export function superAdminMiddleware(req, res, next) {
  if (req.admin?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Akses super admin diperlukan' });
  }
  next();
}

// Generate JWT token
export function generateToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export { JWT_SECRET };
