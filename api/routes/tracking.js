// api/routes/tracking.js
// Route PUBLIK (tanpa auth) untuk tracking:
//  - GET /api/tracking/public-settings: konfigurasi aman untuk browser (dipakai TrackingProvider)
//  - POST /api/tracking/attribution: capture UTM first/last-touch, first-party
// Tidak pernah mengembalikan secret atau internal config penuh.

import { Router } from 'express';
import { getCachedPublicSettings } from '../lib/tracking/publicSettingsCache.js';
import { resolveEventMapping } from '../lib/tracking/eventRegistry.js';
import { getRawSettings } from '../lib/tracking/settingsRepository.js';
import { captureTouch } from '../lib/tracking/attribution.js';

const router = Router();

function ok(res, data) {
  res.status(200).json({ success: true, data });
}
function fail(res, status, code, message) {
  res.status(status).json({ success: false, error: { code, message } });
}

// GET /api/tracking/public-settings
router.get('/public-settings', async (req, res) => {
  try {
    const [publicSettings, raw] = await Promise.all([getCachedPublicSettings(), getRawSettings()]);
    const mapping = resolveEventMapping(raw.event_mapping_json);
    const enabledEvents = Object.fromEntries(
      Object.entries(mapping)
        .filter(([, def]) => def.enabled)
        .map(([name, def]) => [
          name,
          {
            meta: def.meta.channel === 'browser' || def.meta.channel === 'browser_and_server' ? def.meta.eventName : null,
            ga4: def.ga4.channel === 'browser' ? def.ga4.eventName : null,
          },
        ])
    );
    ok(res, { ...publicSettings, events: enabledEvents });
  } catch (err) {
    console.error('Get public tracking settings error:', err);
    // Gagal ambil settings tidak boleh mematahkan halaman — kembalikan tracking nonaktif.
    ok(res, {
      metaBrowserEnabled: false,
      metaPixelId: '',
      gaBrowserEnabled: false,
      gaMeasurementId: '',
      consent: { bannerEnabled: false },
      excludeAdminRoutes: true,
      debug: false,
      environment: 'production',
      events: {},
    });
  }
});

// POST /api/tracking/attribution — body: { anonymousId, utm_source, utm_medium, utm_campaign, utm_content, utm_term, landing_path, referrer, fbclid, gclid }
router.post('/attribution', async (req, res) => {
  try {
    const { anonymousId, ...touch } = req.body || {};
    if (!anonymousId || typeof anonymousId !== 'string' || anonymousId.length > 100) {
      return fail(res, 400, 'TRACKING_CONFIG_INVALID', 'anonymousId tidak valid');
    }
    await captureTouch(anonymousId, touch);
    ok(res, { captured: true });
  } catch (err) {
    console.error('Capture attribution error:', err);
    // Tidak kritikal untuk UX — tetap balas sukses semu supaya browser tidak retry-loop.
    ok(res, { captured: false });
  }
});

export default router;
