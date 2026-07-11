import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// POST /api/push/subscribe — simpan push subscription browser user
router.post('/subscribe', async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Payload subscription tidak lengkap' });
    }

    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE SET user_id = $1, p256dh = $3, auth = $4`,
      [req.user.userId, endpoint, keys.p256dh, keys.auth]
    );
    res.status(201).json({ subscribed: true });
  } catch (err) {
    console.error('Push subscribe error:', err);
    res.status(500).json({ error: 'Gagal menyimpan subscription notifikasi' });
  }
});

// DELETE /api/push/subscribe — berhenti berlangganan (dipanggil sebelum unregister browser)
router.delete('/subscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) {
      await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
    }
    res.json({ unsubscribed: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus subscription' });
  }
});

// GET /api/push/vapid-public-key — client butuh ini untuk PushManager.subscribe()
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
});

export default router;
