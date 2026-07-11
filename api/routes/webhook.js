import crypto from 'crypto';
import { execSync } from 'child_process';
import { readdirSync } from 'fs';
import { join } from 'path';
import { Router } from 'express';

const router = Router();

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'finepro-deploy-secret-change-me';
const PROJECT_DIR = '/home/ubuntu/projects/finepro';
const DEPLOY_DIR = '/var/www/finepro';

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

function run(cmd, cwd = PROJECT_DIR) {
  return execSync(cmd, { cwd, encoding: 'utf-8', timeout: 120000 });
}

function runMigrations() {
  const migDir = join(PROJECT_DIR, 'supabase', 'migrations');
  const files = readdirSync(migDir).filter(f => f.endsWith('.sql')).sort();
  const results = [];
  for (const f of files) {
    const path = join(migDir, f);
    const out = execSync(
      `PGPASSWORD="${process.env.DB_PASSWORD}" psql -h 127.0.0.1 -U keuangan_app -d keuangan -f "${path}" 2>&1`,
      { encoding: 'utf-8', timeout: 30000 }
    ).trim();
    results.push(`${f}: ${out || 'OK (no changes)'}`);
  }
  return results.join('\n');
}

// POST /api/webhook/github
router.post('/github', (req, res) => {
  // Verifikasi signature
  if (!verifySignature(req)) {
    return res.status(403).json({ error: 'Invalid signature' });
  }

  // Hanya proses push ke main
  const ref = req.body?.ref;
  if (ref !== 'refs/heads/main') {
    return res.json({ skipped: true, reason: `ignored ref: ${ref}` });
  }

  console.log(`[webhook] Deploy triggered by push to main`);
  const log = [];

  try {
    log.push(run('git fetch origin main').trim());
    log.push(run('git reset --hard origin/main').trim());
    log.push('Migrations:\n' + runMigrations());
    log.push(run('npm install --production=false 2>&1').trim().split('\n').slice(-3).join('\n'));
    log.push(run('npm install --production=false 2>&1', PROJECT_DIR + '/api').trim().split('\n').slice(-3).join('\n'));
    log.push(run('npm run build 2>&1').trim().split('\n').slice(-3).join('\n'));
    run(`cp -r ${PROJECT_DIR}/dist/* ${DEPLOY_DIR}/`);

    console.log('[webhook] Deploy OK');
    res.json({ status: 'deployed', log });
  } catch (err) {
    console.error('[webhook] Deploy FAILED:', err.message);
    res.status(500).json({ status: 'failed', error: err.message, log });
  }
});

export default router;
