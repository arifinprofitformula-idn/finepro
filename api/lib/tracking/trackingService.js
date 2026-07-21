// api/lib/tracking/trackingService.js
// Facade tunggal untuk mengirim business event ke provider server-side (Meta
// CAPI + GA4 Measurement Protocol). Dipanggil SETELAH business transaction
// commit — kegagalan tracking tidak boleh pernah melempar ke caller.
//
// Alur: baca settings -> resolve mapping event -> filter parameter allowlist
// -> cek idempotency -> kirim provider (allSettled) -> tulis delivery log.

import { getDecryptedSettings } from './settingsRepository.js';
import { resolveEventMapping, filterParameters, isValidEventName } from './eventRegistry.js';
import { normalizeAndHashEmail, normalizeAndHashPhone, hashExternalId } from './normalize.js';
import { buildMetaEventPayload, sendMetaEvent } from './metaConversionsApi.js';
import { buildGa4Payload, sendGa4Event } from './ga4MeasurementProtocol.js';
import { recordDelivery, wasAlreadyDelivered } from './deliveryLog.js';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_BASE_URL || 'https://finepro.my.id').replace(/\/$/, '');

function sanitizeErrorMessage(err) {
  // Jangan pernah biarkan pesan error membocorkan token/secret (mis. dari URL fetch).
  const raw = String(err?.message || 'Unknown error');
  return raw.replace(/access_token=[^&\s]+/gi, 'access_token=[redacted]').replace(/api_secret=[^&\s]+/gi, 'api_secret=[redacted]').slice(0, 400);
}

async function deliverMeta({ eventName, providerEventName, eventId, parameters, userData, settings, testEventCode }) {
  if (!settings.meta_server_enabled || !settings.meta_pixel_id || !settings.meta_access_token) {
    return { skipped: true, reason: 'META_NOT_CONFIGURED' };
  }

  const alreadySent = await wasAlreadyDelivered('meta', 'server', eventId);
  if (alreadySent) {
    return { skipped: true, reason: 'TRACKING_DUPLICATE_EVENT' };
  }

  const payload = buildMetaEventPayload({
    eventName: providerEventName,
    eventId,
    eventSourceUrl: SITE_URL,
    userData,
    customData: parameters,
    testEventCode: testEventCode || undefined,
  });

  try {
    const result = await sendMetaEvent({
      pixelId: settings.meta_pixel_id,
      accessToken: settings.meta_access_token,
      graphApiVersion: settings.meta_graph_api_version || 'v21.0',
      payload,
    });
    await recordDelivery({
      eventId,
      internalEventName: eventName,
      provider: 'meta',
      channel: 'server',
      providerEventName,
      status: 'success',
      responseCode: result.status,
      attemptCount: result.attempt,
    });
    return { ok: true };
  } catch (err) {
    await recordDelivery({
      eventId,
      internalEventName: eventName,
      provider: 'meta',
      channel: 'server',
      providerEventName,
      status: 'failed',
      responseCode: err.status || null,
      errorCode: err.code || 'META_API_ERROR',
      errorMessageSanitized: sanitizeErrorMessage(err),
      attemptCount: err.attempt || 1,
    });
    return { ok: false, error: err };
  }
}

async function deliverGa4({ eventName, providerEventName, eventId, parameters, clientId, userId, settings }) {
  if (!settings.ga4_server_enabled || !settings.ga4_measurement_id || !settings.ga4_api_secret) {
    return { skipped: true, reason: 'GA4_NOT_CONFIGURED' };
  }

  const alreadySent = await wasAlreadyDelivered('ga4', 'server', eventId);
  if (alreadySent) {
    return { skipped: true, reason: 'TRACKING_DUPLICATE_EVENT' };
  }

  const payload = buildGa4Payload({
    clientId: clientId || `server.${eventId}`,
    userId: userId || undefined,
    events: [{ name: providerEventName, params: parameters }],
  });

  try {
    const result = await sendGa4Event({
      measurementId: settings.ga4_measurement_id,
      apiSecret: settings.ga4_api_secret,
      region: settings.ga4_region,
      payload,
    });
    await recordDelivery({
      eventId,
      internalEventName: eventName,
      provider: 'ga4',
      channel: 'server',
      providerEventName,
      status: 'success',
      responseCode: result.status,
      attemptCount: result.attempt,
    });
    return { ok: true };
  } catch (err) {
    await recordDelivery({
      eventId,
      internalEventName: eventName,
      provider: 'ga4',
      channel: 'server',
      providerEventName,
      status: 'failed',
      responseCode: err.status || null,
      errorCode: err.code || 'GA4_API_ERROR',
      errorMessageSanitized: sanitizeErrorMessage(err),
    });
    return { ok: false, error: err };
  }
}

/**
 * trackBusinessEvent({ eventName, eventId, user, requestContext, parameters, attribution, consent })
 *
 * - eventName: salah satu INTERNAL_EVENT_NAMES (lib/tracking/eventRegistry.js)
 * - eventId: UUID yang SAMA dipakai browser (Meta Pixel) untuk dedup event_id
 * - user: { id, email, phone } opsional — untuk Meta user_data (di-hash di sini, tidak pernah disimpan mentah)
 * - requestContext: { clientIp, userAgent, fbp, fbc, gaClientId } opsional
 * - parameters: object bebas — akan difilter lewat allowlist per event
 * - consent: { marketing: boolean, analytics: boolean } — kalau consent ditolak, provider terkait di-skip
 *
 * TIDAK PERNAH melempar error ke caller — semua kegagalan diserap & dicatat ke delivery log.
 */
export async function trackBusinessEvent({
  eventName,
  eventId,
  user = {},
  requestContext = {},
  parameters = {},
  consent = { marketing: true, analytics: true },
}) {
  try {
    if (!isValidEventName(eventName) || !eventId) return;

    const settings = await getDecryptedSettings();
    const mapping = resolveEventMapping(settings.event_mapping_json);
    const def = mapping[eventName];
    if (!def || !def.enabled) return;

    const filteredParams = filterParameters(eventName, parameters);

    const tasks = [];

    const metaChannel = def.meta.channel;
    const wantsMetaServer = metaChannel === 'server' || metaChannel === 'browser_and_server';
    if (wantsMetaServer && consent.marketing) {
      const userData = {};
      const emailHash = normalizeAndHashEmail(user.email);
      const phoneHash = normalizeAndHashPhone(user.phone);
      const externalIdHash = hashExternalId(user.id);
      if (emailHash) userData.em = [emailHash];
      if (phoneHash) userData.ph = [phoneHash];
      if (externalIdHash) userData.external_id = [externalIdHash];
      if (requestContext.clientIp) userData.client_ip_address = requestContext.clientIp;
      if (requestContext.userAgent) userData.client_user_agent = requestContext.userAgent;
      if (requestContext.fbp) userData.fbp = requestContext.fbp;
      if (requestContext.fbc) userData.fbc = requestContext.fbc;

      tasks.push(
        deliverMeta({
          eventName,
          providerEventName: def.meta.eventName,
          eventId,
          parameters: filteredParams,
          userData,
          settings,
          testEventCode: requestContext.metaTestEventCode,
        })
      );
    }

    const ga4Channel = def.ga4.channel;
    if (ga4Channel === 'server' && consent.analytics) {
      tasks.push(
        deliverGa4({
          eventName,
          providerEventName: def.ga4.eventName,
          eventId,
          parameters: filteredParams,
          clientId: requestContext.gaClientId,
          userId: consent.analytics ? user.id : undefined,
          settings,
        })
      );
    }

    await Promise.allSettled(tasks);
  } catch (err) {
    console.error('[tracking] trackBusinessEvent gagal (diserap, tidak menggagalkan business flow):', err.message);
  }
}
