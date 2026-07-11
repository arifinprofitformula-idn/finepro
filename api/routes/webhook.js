import crypto from 'crypto';
import { exec } from 'child_process';
import { Router } from 'express';

const router = Router();

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'finepro-deploy-secret-change-me';

function verifySignature(req) {
  const sig = req.headers['x-hub-signature-256'];
  if (!sig) return false;
  const raw = JSON.stringify(req.body);
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const computed = 'sha256=' + hmac.update(raw).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(computed));
  } catch {
    return false;
  }
}

// POST /api/webhook/github
router.post('/github', (req, res) => {
  if (!verifySignature(req)) {
    return res.status(403).json({ error: 'Invalid signature' });
  }

  const ref = req.body?.ref;
  if (ref !== 'refs/heads/main') {
    return res.json({ skipped: true, reason: `ignored ref: ${ref}` });
  }

  console.log('[webhook] Deploy triggered');

  // Jalankan deploy.sh di background agar tidak terpengaruh restart API
  exec('bash /home/ubuntu/projects/finepro/deploy.sh &');

  res.json({ status: 'deploying', log: 'deploy.sh started in background' });
});

export default router;
