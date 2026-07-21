// src/components/tracking/RouteChangeTracker.jsx
// Melacak page_view setelah perubahan pathname/search. FinePro tidak memakai
// react-router (routing state-based, lihat src/App.jsx), jadi navigasi nyata
// yang perlu dilacak adalah history.pushState/replaceState/popstate (dipakai
// beberapa halaman seperti /payment/finish) — bukan re-render biasa.
//
// PageView pertama TIDAK dikirim dua kali: Meta Pixel sudah otomatis mengirim
// PageView saat fbq('init', ...) dipanggil (lihat metaPixelClient.js), jadi di
// sini initial mount hanya mengirim GA4 page_view (send_page_view dimatikan
// saat init GA4 justru supaya page_view selalu lewat jalur manual ini).

import { useEffect, useRef } from "react";
import { useTracking } from "./TrackingProvider.jsx";
import { trackGaBrowserEvent } from "../../lib/tracking/ga4Client.js";
import { trackMetaBrowserEvent } from "../../lib/tracking/metaPixelClient.js";

function currentUrlKey() {
  return `${window.location.pathname}${window.location.search}`;
}

export default function RouteChangeTracker() {
  const { settings, consent, excluded, normalizeUrlForTracking } = useTracking();
  const lastKeyRef = useRef(null);
  const didInitialRef = useRef(false);

  useEffect(() => {
    if (excluded || !settings || typeof window === "undefined") return undefined;

    function sendPageView({ isInitial }) {
      const key = currentUrlKey();
      if (key === lastKeyRef.current) return; // re-render biasa, bukan navigasi baru
      lastKeyRef.current = key;

      const normalizedPath = normalizeUrlForTracking(window.location.href);
      const params = {
        page_path: normalizedPath,
        page_location: `${window.location.origin}${normalizedPath}`,
      };

      if (settings.gaBrowserEnabled && consent?.analytics === "granted") {
        trackGaBrowserEvent({
          eventName: "page_view",
          parameters: { ...params, page_title: document.title || undefined },
        });
      }

      // Event pertama: Meta Pixel PageView sudah otomatis terkirim saat fbq('init', ...).
      if (!isInitial && settings.metaBrowserEnabled && consent?.marketing === "granted") {
        trackMetaBrowserEvent({ eventName: "PageView", parameters: {} });
      }
    }

    if (!didInitialRef.current) {
      didInitialRef.current = true;
      sendPageView({ isInitial: true });
    }

    function handleNavigation() {
      sendPageView({ isInitial: false });
    }

    window.addEventListener("popstate", handleNavigation);

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
    window.history.pushState = function patchedPushState(...args) {
      const result = originalPushState.apply(this, args);
      handleNavigation();
      return result;
    };
    window.history.replaceState = function patchedReplaceState(...args) {
      const result = originalReplaceState.apply(this, args);
      handleNavigation();
      return result;
    };

    return () => {
      window.removeEventListener("popstate", handleNavigation);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, [excluded, settings, consent, normalizeUrlForTracking]);

  return null;
}
