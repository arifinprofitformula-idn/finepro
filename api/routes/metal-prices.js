import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getCurrentMetalPrices } from '../services/apeEpi.js';

const router = Router();
router.use(authMiddleware);

router.get('/current', async (req, res) => {
  try {
    const prices = await getCurrentMetalPrices();
    res.json(prices);
  } catch (err) {
    console.error('Metal prices error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Gagal mengambil harga emas dan perak' });
  }
});

export default router;
