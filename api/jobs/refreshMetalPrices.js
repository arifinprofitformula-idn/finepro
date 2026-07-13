// api/jobs/refreshMetalPrices.js
// Job terpisah dari Express server — dijalankan oleh cron/di VPS untuk
// auto-refresh harga emas & perak dari APE-EPI API.
//
// Jalankan manual untuk tes:
//   node jobs/refreshMetalPrices.js
//
// Cron setup:
//   0 8,13 * * * cd /home/ubuntu/projects/finepro/api && /usr/bin/node jobs/refreshMetalPrices.js >> /var/log/finepro-metal-refresh.log 2>&1

import pool from '../db.js';
import { getCurrentMetalPrices } from '../services/apeEpi.js';

const fmt = (n) => Number(n || 0).toLocaleString('id-ID');

async function run() {
  console.log(`[refreshMetalPrices] === Mulai refresh — ${new Date().toISOString()} ===`);

  const result = await getCurrentMetalPrices({
    forceRefresh: true,
    bypassDailyLimit: true,
  });

  if (!result.enabled) {
    const reason = result.error || 'APE-EPI tidak enabled / API key belum diatur';
    console.error(`[refreshMetalPrices] GAGAL: ${reason}`);
    process.exit(1);
  }

  console.log(`[refreshMetalPrices] Emas   : Rp ${fmt(result.gold?.price_per_gram)}/gr — ${result.gold?.brand} (${result.gold?.level}) — data ${result.gold?.date}`);
  console.log(`[refreshMetalPrices] Perak  : Rp ${fmt(result.silver?.price_per_gram)}/gr — ${result.silver?.brand} (${result.silver?.level}) — data ${result.silver?.date}`);

  if (result.gold_buyback) {
    console.log(`[refreshMetalPrices] Buyback Emas : Rp ${fmt(result.gold_buyback.price_per_gram)}/gr`);
  }
  if (result.silver_buyback) {
    console.log(`[refreshMetalPrices] Buyback Perak: Rp ${fmt(result.silver_buyback.price_per_gram)}/gr`);
  }

  console.log(`[refreshMetalPrices] Selesai. Cached: ${result.cached}, Daily quota: ${result.daily_request_count ?? 'bypass'}/${result.daily_request_limit}`);
}

run()
  .then(() => {
    console.log('[refreshMetalPrices] Job selesai sukses.');
    return pool.end();
  })
  .catch(async (err) => {
    console.error(`[refreshMetalPrices] Job gagal total: ${err.message}`);
    await pool.end();
    process.exit(1);
  });
