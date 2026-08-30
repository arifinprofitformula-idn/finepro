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

  // PENTING: deploy.sh me-restart finepro-api.service sendiri. Karena
  // KillMode=control-group pada unit ini, `systemctl restart` membunuh
  // SEMUA proses dalam cgroup service — termasuk deploy.sh kalau dia anak
  // proses Node ini (backgrounding biasa dengan `&` TIDAK cukup, cgroup
  // membership tetap ikut proses induk, bukan proses shell). Solusinya:
  // jalankan deploy.sh sebagai transient systemd scope terpisah (cgroup
  // sendiri) lewat `systemd-run`, supaya restart service ini tidak
  // memutus proses deploy di tengah jalan.
  const unitName = `finepro-deploy-${Date.now()}`;
  exec(
    `sudo -n /usr/bin/systemd-run --unit=${unitName} --collect ` +
      '--property=User=ubuntu /usr/bin/bash /home/ubuntu/projects/finepro/deploy.sh',
    (err, stdout, stderr) => {
      if (err) console.error('[webhook] Failed to launch deploy:', err.message, stderr);
    }
  );

  res.json({ status: 'deploying', log: 'deploy.sh started in background' });
});

export default router;
