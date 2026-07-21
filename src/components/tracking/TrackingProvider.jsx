// src/components/tracking/TrackingProvider.jsx
// Provider global tracking: ambil public settings dari server, kelola consent,
// muat Meta Pixel/GA4 (afterInteractive, sekali saja) SETELAH consent
// diberikan, dan sediakan context untuk RouteChangeTracker & event helpers
// bisnis lain di aplikasi.
//
// Browser HANYA menerima subset aman dari /api/tracking/public-settings
// (lihat api/lib/tracking/settingsRepository.js#toPublicSettings) — tidak ada
// access token / api secret / konfigurasi internal penuh yang sampai ke sini.

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getPublicTrackingSettings, sendAttributionTouch } from "../../api/tracking.js";
import { getConsent, setConsent, needsConsent } from "../../lib/tracking/consent.js";
import { getOrCreateAnonymousId } from "../../lib/tracking/anonymousId.js";
import { initMetaPixel, trackMetaBrowserEvent } from "../../lib/tracking/metaPixelClient.js";
import { initGa4, setGaConsentDefault, updateGaConsent, trackGaBrowserEvent, getGaClientId } from "../../lib/tracking/ga4Client.js";

const TrackingContext = createContext(null);

const OPEN_PRIVACY_SETTINGS_EVENT = "finepro:open-privacy-settings";
const SENSITIVE_URL_PARAMS = ["token", "password", "verify_token", "reset_token", "order_id"];
const SAFE_UTM_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"];

function isLocalHost() {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname);
}

function isAdminPath() {
  if (typeof window === "undefined") return false;
  return window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/");
}

function normalizeUrlForTracking(url) {
  try {
    const parsed = new URL(url, window.location.origin);
    for (const param of SENSITIVE_URL_PARAMS) parsed.searchParams.delete(param);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return window.location.pathname;
  }
}

export function openPrivacySettings() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_PRIVACY_SETTINGS_EVENT));
}

export function usePrivacySettingsEvent(handler) {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    window.addEventListener(OPEN_PRIVACY_SETTINGS_EVENT, handler);
    return () => window.removeEventListener(OPEN_PRIVACY_SETTINGS_EVENT, handler);
  }, [handler]);
}

export function useTracking() {
  return useContext(TrackingContext);
}

export default function TrackingProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [consent, setConsentState] = useState(() => getConsent());
  const capturedAttribution = useRef(false);

  const excluded = useMemo(() => isAdminPath(), []);

  useEffect(() => {
    if (excluded) return;
    let cancelled = false;
    getPublicTrackingSettings().then((data) => {
      if (!cancelled) setSettings(data);
    });
    return () => {
      cancelled = true;
    };
  }, [excluded]);

  // Consent Mode default HARUS diset sebelum gtag('js'/'config') dipanggil — aman-default: denied.
  useEffect(() => {
    if (excluded || !settings) return;
    setGaConsentDefault({
      analytics: consent?.analytics || settings.consent?.defaultAnalytics || "denied",
      marketing: consent?.marketing || settings.consent?.defaultMarketing || "denied",
    });
  }, [excluded, settings, consent]);

  // Muat Meta Pixel / GA4 hanya kalau: enabled di admin, consent kategori terkait granted,
  // bukan halaman admin yang dikecualikan, dan bukan localhost (kecuali debug diaktifkan).
  useEffect(() => {
    if (excluded || !settings) return;
    const skipBecauseLocalhost = isLocalHost() && !settings.debug;
    if (skipBecauseLocalhost) return;

    if (settings.metaBrowserEnabled && consent?.marketing === "granted") {
      initMetaPixel(settings.metaPixelId);
    }
    if (settings.gaBrowserEnabled && consent?.analytics === "granted") {
      initGa4(settings.gaMeasurementId);
    }
  }, [excluded, settings, consent]);

  // Capture UTM attribution first-party (first/last touch) — tidak tergantung consent pixel/GA4
  // karena ini hanya disimpan di DB FinePro sendiri, bukan dikirim ke Meta/Google.
  useEffect(() => {
    if (excluded || capturedAttribution.current || typeof window === "undefined") return;
    capturedAttribution.current = true;
    const params = new URLSearchParams(window.location.search);
    const hasSignal = SAFE_UTM_PARAMS.some((key) => params.get(key));
    if (!hasSignal && !document.referrer) return;

    const anonymousId = getOrCreateAnonymousId();
    if (!anonymousId) return;

    sendAttributionTouch({
      anonymousId,
      utm_source: params.get("utm_source"),
      utm_medium: params.get("utm_medium"),
      utm_campaign: params.get("utm_campaign"),
      utm_content: params.get("utm_content"),
      utm_term: params.get("utm_term"),
      fbclid: params.get("fbclid"),
      gclid: params.get("gclid"),
      landing_path: window.location.pathname,
      referrer: document.referrer || null,
    }).catch(() => {});
  }, [excluded]);

  function updateConsentChoice({ analytics, marketing }) {
    const version = settings?.consent?.version || "1";
    setConsent({ version, analytics, marketing });
    updateGaConsent({ analytics, marketing });
    setConsentState({ version, analytics, marketing, timestamp: new Date().toISOString() });
  }

  function trackEvent(internalEventName, { eventId, parameters = {} } = {}) {
    if (excluded || !settings) return;
    const def = settings.events?.[internalEventName];
    if (!def) return;
    if (def.meta && consent?.marketing === "granted") {
      trackMetaBrowserEvent({ eventName: def.meta, eventId, parameters });
    }
    if (def.ga4 && consent?.analytics === "granted") {
      trackGaBrowserEvent({ eventName: def.ga4, parameters });
    }
  }

  const value = useMemo(
    () => ({
      settings,
      consent,
      excluded,
      bannerShouldShow: !excluded && Boolean(settings?.consent?.bannerEnabled) && needsConsent(settings?.consent?.version),
      updateConsentChoice,
      trackEvent,
      normalizeUrlForTracking,
      getGaClientId,
      getOrCreateAnonymousId,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings, consent, excluded]
  );

  return <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>;
}
