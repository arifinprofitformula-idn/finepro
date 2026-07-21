// api/routes/adminTracking.js
// Admin-only routes untuk mengelola tracking (Meta Pixel/CAPI, GA4/Measurement
// Protocol, consent, event mapping, delivery logs). Dipasang di
// /api/admin/tracking, di belakang authMiddleware + adminMiddleware (lihat
// server.js & middleware/auth.js — sama seperti /api/admin lainnya).

import { Router } from 'express';
import crypto from 'crypto';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { auditAdminAction } from '../services/appSettings.js';
import {
  getRawSettings,
  getDecryptedSettings,
  toAdminView,
  updateSettings,
  clearSecret,
  recordTestResult,
} from '../lib/tracking/settingsRepository.js';
import { resolveEventMapping, DEFAULT_EVENT_MAPPING, wouldGa4DoubleCount } from '../lib/tracking/eventRegistry.js';
import { listDeliveries } from '../lib/tracking/deliveryLog.js';
import { buildMetaEventPayload, sendMetaEvent } from '../lib/tracking/metaConversionsApi.js';
import { buildGa4Payload, validateGa4Payload, sendGa4Event } from '../lib/tracking/ga4MeasurementProtocol.js';
import { invalidatePublicSettingsCache } from '../lib/tracking/publicSettingsCache.js';

const router = Router();
router.use(authMiddleware, adminMiddleware);

const testEndpointLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.admin?.id || ipKeyGenerator(req.ip),
  message: { success: false, error: { code: 'META_RATE_LIMITED', message: 'Terlalu banyak percobaan test, coba lagi dalam beberapa menit' } },
});

function ok(res, data, status = 200) {
  res.status(status).json({ success: true, data });
}

function fail(res, status, code, message, details) {
  res.status(status).json({ success: false, error: { code, message, ...(details ? { details } : {}) } });
}

const SECRET_CLEAR_FIELDS = new Set(['meta_access_token', 'meta_test_event_code', 'ga4_api_secret']);

// GET /api/admin/tracking/settings
router.get('/settings', async (req, res) => {
  try {
    const raw = await getRawSettings();
    ok(res, { settings: toAdminView(raw), eventMapping: resolveEventMapping(raw.event_mapping_json) });
  } catch (err) {
    console.error('Get tracking settings error:', err);
    fail(res, 500, 'TRACKING_CONFIG_INVALID', 'Gagal mengambil pengaturan tracking');
  }
});

// PATCH /api/admin/tracking/settings
router.patch('/settings', async (req, res) => {
  try {
    const next = await updateSettings(req.body || {}, req.admin.id);
    invalidatePublicSettingsCache();
    await auditAdminAction(req.admin.id, 'tracking.settings.update', 'app_settings', 'tracking', {
      fields: Object.keys(req.body || {}),
    });
    ok(res, { settings: toAdminView(next) });
  } catch (err) {
    console.error('Update tracking settings error:', err);
    if (err.code === 'TRACKING_CONFIG_INVALID') {
      return fail(res, 400, err.code, err.message);
    }
    fail(res, 500, 'TRACKING_CONFIG_INVALID', 'Gagal menyimpan pengaturan tracking');
  }
});

// POST /api/admin/tracking/settings/secrets/:field/clear
router.post('/settings/secrets/:field/clear', async (req, res) => {
  try {
    const { field } = req.params;
    if (!SECRET_CLEAR_FIELDS.has(field)) {
      return fail(res, 400, 'TRACKING_CONFIG_INVALID', 'Field secret tidak dikenal');
    }
    const next = await clearSecret(field, req.admin.id);
    invalidatePublicSettingsCache();
    await auditAdminAction(req.admin.id, 'tracking.secret.clear', 'app_settings', 'tracking', { field });
    ok(res, { settings: toAdminView(next) });
  } catch (err) {
    console.error('Clear tracking secret error:', err);
    fail(res, 500, 'TRACKING_CONFIG_INVALID', 'Gagal menghapus secret');
  }
});

// PATCH /api/admin/tracking/event-mapping
router.patch('/event-mapping', async (req, res) => {
  try {
    const patch = req.body?.eventMapping || {};
    const current = await getRawSettings();
    const nextOverrides = { ...(current.event_mapping_json || {}) };

    for (const [eventName, override] of Object.entries(patch)) {
      if (!DEFAULT_EVENT_MAPPING[eventName]) continue;
      const safeOverride = {
        enabled: override.enabled !== undefined ? Boolean(override.enabled) : undefined,
        meta: override.meta
          ? {
              eventName: typeof override.meta.eventName === 'string' ? override.meta.eventName : undefined,
              channel: override.meta.channel,
            }
          : undefined,
        ga4: override.ga4
          ? {
              eventName: typeof override.ga4.eventName === 'string' ? override.ga4.eventName : undefined,
              channel: override.ga4.channel,
            }
          : undefined,
      };

      // Cegah double counting GA4: tolak kalau admin mencoba set GA4 browser+server sekaligus untuk event yang sama.
      const resolvedGa4Channel = safeOverride.ga4?.channel;
      if (resolvedGa4Channel === 'browser_and_server' || wouldGa4DoubleCount(eventName, safeOverride.meta?.channel, resolvedGa4Channel)) {
        return fail(
          res,
          400,
          'TRACKING_CONFIG_INVALID',
          `Event "${eventName}" tidak boleh mengirim GA4 lewat browser dan server sekaligus (double counting) tanpa mekanisme idempotency eksplisit`
        );
      }

      nextOverrides[eventName] = { ...nextOverrides[eventName], ...safeOverride };
    }

    const next = await updateSettings({ event_mapping_json: nextOverrides }, req.admin.id);
    await auditAdminAction(req.admin.id, 'tracking.event_mapping.update', 'app_settings', 'tracking', {
      events: Object.keys(patch),
    });
    ok(res, { eventMapping: resolveEventMapping(next.event_mapping_json) });
  } catch (err) {
    console.error('Update event mapping error:', err);
    fail(res, 500, 'TRACKING_CONFIG_INVALID', 'Gagal menyimpan event mapping');
  }
});

// POST /api/admin/tracking/event-mapping/reset
router.post('/event-mapping/reset', async (req, res) => {
  try {
    const next = await updateSettings({ event_mapping_json: {} }, req.admin.id);
    await auditAdminAction(req.admin.id, 'tracking.event_mapping.reset', 'app_settings', 'tracking', {});
    ok(res, { eventMapping: resolveEventMapping(next.event_mapping_json) });
  } catch (err) {
    console.error('Reset event mapping error:', err);
    fail(res, 500, 'TRACKING_CONFIG_INVALID', 'Gagal reset event mapping');
  }
});

// POST /api/admin/tracking/test-meta — kirim custom event FineProTrackingTest via CAPI.
router.post('/test-meta', testEndpointLimiter, async (req, res) => {
  try {
    const settings = await getDecryptedSettings();
    if (!settings.meta_pixel_id || !settings.meta_access_token) {
      await recordTestResult('meta', 'failed', 'Pixel ID atau Access Token belum dikonfigurasi');
      return fail(res, 400, 'META_NOT_CONFIGURED', 'Event belum terkirim karena Pixel ID atau Access Token Meta belum dikonfigurasi.');
    }

    const eventId = crypto.randomUUID();
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_BASE_URL || 'https://finepro.my.id').replace(/\/$/, '');
    const payload = buildMetaEventPayload({
      eventName: 'FineProTrackingTest',
      eventId,
      eventSourceUrl: siteUrl,
      actionSource: 'website',
      userData: {},
      testEventCode: settings.meta_test_event_code || undefined,
    });

    const result = await sendMetaEvent({
      pixelId: settings.meta_pixel_id,
      accessToken: settings.meta_access_token,
      graphApiVersion: settings.meta_graph_api_version || 'v21.0',
      payload,
    });

    await recordTestResult('meta', 'success', `HTTP ${result.status}`);
    await auditAdminAction(req.admin.id, 'tracking.meta.test', 'app_settings', 'tracking', { eventId, status: result.status });

    ok(res, {
      eventId,
      responseCode: result.status,
      response: { events_received: result.body?.events_received, fbtrace_id: result.body?.fbtrace_id },
    });
  } catch (err) {
    console.error('Meta CAPI test error:', err.message);
    await recordTestResult('meta', 'failed', err.message);
    const status = err.status && err.status < 500 ? 400 : 502;
    fail(res, status, err.code || 'META_API_ERROR', 'Gagal mengirim test event ke Meta Conversions API. Periksa kembali Access Token dan Pixel ID.');
  }
});

// POST /api/admin/tracking/settings/meta/clear-test-event-code — shortcut khusus di spec ("Clear Test Event Code").
router.post('/meta/clear-test-event-code', async (req, res) => {
  try {
    const next = await clearSecret('meta_test_event_code', req.admin.id);
    await auditAdminAction(req.admin.id, 'tracking.secret.clear', 'app_settings', 'tracking', { field: 'meta_test_event_code' });
    ok(res, { settings: toAdminView(next) });
  } catch (err) {
    fail(res, 500, 'TRACKING_CONFIG_INVALID', 'Gagal menghapus Test Event Code');
  }
});

// POST /api/admin/tracking/validate-ga4 — panggil /debug/mp/collect (ENFORCE_RECOMMENDATIONS).
router.post('/validate-ga4', testEndpointLimiter, async (req, res) => {
  try {
    const settings = await getDecryptedSettings();
    if (!settings.ga4_measurement_id || !settings.ga4_api_secret) {
      return fail(res, 400, 'GA4_NOT_CONFIGURED', 'Validasi belum bisa dilakukan karena Measurement ID atau API Secret GA4 belum dikonfigurasi.');
    }

    const payload = buildGa4Payload({
      clientId: `admin-validate.${crypto.randomUUID()}`,
      events: [{ name: 'finepro_tracking_test', params: { debug_mode: 1 } }],
    });

    const result = await validateGa4Payload({
      measurementId: settings.ga4_measurement_id,
      apiSecret: settings.ga4_api_secret,
      region: settings.ga4_region,
      payload,
    });

    const hasErrors = result.validationMessages.some((m) => m.validationCode && m.validationCode !== 'VALUE_INVALID_OK');
    await recordTestResult('ga4', hasErrors ? 'failed' : 'success', `${result.validationMessages.length} pesan validasi`);
    await auditAdminAction(req.admin.id, 'tracking.ga4.validate', 'app_settings', 'tracking', { messageCount: result.validationMessages.length });

    ok(res, { validationMessages: result.validationMessages });
  } catch (err) {
    console.error('GA4 validate error:', err.message);
    await recordTestResult('ga4', 'failed', err.message);
    fail(res, 502, err.code || 'GA4_VALIDATION_FAILED', 'Gagal memvalidasi payload GA4. Endpoint validasi Google sedang tidak bisa dihubungi.');
  }
});

// POST /api/admin/tracking/send-ga4-test — kirim event finepro_tracking_test real-time (debug_mode).
router.post('/send-ga4-test', testEndpointLimiter, async (req, res) => {
  try {
    const settings = await getDecryptedSettings();
    if (!settings.ga4_measurement_id || !settings.ga4_api_secret) {
      return fail(res, 400, 'GA4_NOT_CONFIGURED', 'Event belum terkirim karena Measurement ID atau API Secret GA4 belum dikonfigurasi.');
    }

    const clientId = `admin-test.${crypto.randomUUID()}`;
    const payload = buildGa4Payload({
      clientId,
      events: [
        {
          name: 'finepro_tracking_test',
          params: {
            debug_mode: 1,
            session_id: `${Date.now()}`,
            engagement_time_msec: 100,
          },
        },
      ],
    });

    const result = await sendGa4Event({
      measurementId: settings.ga4_measurement_id,
      apiSecret: settings.ga4_api_secret,
      region: settings.ga4_region,
      payload,
    });

    await recordTestResult('ga4', 'success', `HTTP ${result.status}`);
    await auditAdminAction(req.admin.id, 'tracking.ga4.test', 'app_settings', 'tracking', { clientId, status: result.status });

    ok(res, {
      clientId,
      responseCode: result.status,
      instructions: 'Periksa GA4 Realtime atau DebugView (Configure > DebugView) dalam 1-2 menit untuk melihat event finepro_tracking_test.',
    });
  } catch (err) {
    console.error('GA4 realtime test error:', err.message);
    await recordTestResult('ga4', 'failed', err.message);
    fail(res, 502, err.code || 'GA4_API_ERROR', 'Gagal mengirim event realtime test ke GA4 Measurement Protocol.');
  }
});

// GET /api/admin/tracking/logs
router.get('/logs', async (req, res) => {
  try {
    const { provider, status, event, date_from, date_to, limit, offset } = req.query;
    const { rows, total } = await listDeliveries({
      provider: ['meta', 'ga4'].includes(provider) ? provider : undefined,
      status: ['success', 'failed', 'skipped', 'retrying'].includes(status) ? status : undefined,
      eventName: event || undefined,
      dateFrom: date_from || undefined,
      dateTo: date_to || undefined,
      limit: Number(limit) || 25,
      offset: Number(offset) || 0,
    });
    ok(res, { logs: rows, total, retentionDays: 30 });
  } catch (err) {
    console.error('List tracking logs error:', err);
    fail(res, 500, 'TRACKING_CONFIG_INVALID', 'Gagal mengambil delivery log');
  }
});

export default router;
