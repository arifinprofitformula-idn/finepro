import { Router } from 'express';
import pool from '../db.js';
import { getSetting } from '../services/appSettings.js';
import {
  extractSumopodWebhookReference,
  safeTokenEqual,
  resolveSumopodConfig,
} from '../services/sumopodPayment.js';
import { applyPaymentStatus } from './payments.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const config = resolveSumopodConfig(await getSetting('sumopod_payment'));
    const expectedToken = config.webhook_token;
    const receivedToken = req.get('X-Webhook-Token') || '';
    if (!safeTokenEqual(receivedToken, expectedToken)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const reference = extractSumopodWebhookReference(req.body || {});
    if (!reference.nextStatus) {
      return res.status(200).json({ received: true, ignored: true });
    }

    const paymentResult = await pool.query(
      `SELECT * FROM payments
       WHERE order_id = $1
         AND method = 'sumopod'
         AND ($2::text IS NULL OR provider_payment_id IS NULL OR provider_payment_id = $2)
       LIMIT 1`,
      [reference.orderId, reference.paymentId]
    );
    const payment = paymentResult.rows[0];
    if (!payment) {
      return res.status(200).json({ received: true, ignored: true });
    }

    if (reference.paymentId && !payment.provider_payment_id) {
      await pool.query(
        'UPDATE payments SET provider_payment_id = $1 WHERE order_id = $2 AND provider_payment_id IS NULL',
        [reference.paymentId, reference.orderId]
      );
      payment.provider_payment_id = reference.paymentId;
    }

    if (payment.status === 'paid' || payment.status === reference.nextStatus) {
      return res.status(200).json({ received: true, alreadyProcessed: true });
    }

    await applyPaymentStatus(payment, reference.nextStatus);
    return res.status(200).json({ received: true });
  } catch (error) {
    if (String(error?.message || '').includes('order_id')) {
      return res.status(400).json({ error: 'Payload webhook tidak valid' });
    }
    console.error('[sumopod webhook] Gagal memproses event:', error.message);
    return res.status(500).json({ error: 'Gagal memproses webhook' });
  }
});

export default router;
