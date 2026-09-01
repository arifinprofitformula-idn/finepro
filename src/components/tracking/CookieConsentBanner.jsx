// src/components/tracking/CookieConsentBanner.jsx
// Consent banner: non-modal bottom surface, equal-effort choices,
// responsive safe area, and persistent preferences via TrackingProvider.

import { useCallback, useEffect, useState } from "react";
import { Cookie, Settings2, ShieldCheck, X } from "lucide-react";
import { useTracking, usePrivacySettingsEvent } from "./TrackingProvider.jsx";

function CategoryRow({ title, description, checked, disabled, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-border bg-neutral-50 p-3 md:items-start md:p-3.5">
      <div className="min-w-0 pr-2">
        <div className="text-xs font-bold text-navy md:text-sm">{title}</div>
        <p className="mt-1 hidden text-xs font-medium leading-5 text-neutral-600 md:block">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative flex h-7 w-12 flex-shrink-0 items-center rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 md:h-8 md:w-14 ${
          checked ? "border-violet bg-violet" : "border-neutral-300 bg-neutral-200"
        } ${disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform md:h-6 md:w-6 ${checked ? "translate-x-6 md:translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

export default function CookieConsentBanner() {
  const { settings, consent, bannerShouldShow, updateConsentChoice } = useTracking();
  const [visible, setVisible] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [choices, setChoices] = useState({ analytics: false, marketing: false });

  useEffect(() => setVisible(Boolean(bannerShouldShow)), [bannerShouldShow]);
  useEffect(() => {
    if (!customizeOpen) return;
    setChoices({
      analytics: consent?.analytics === "granted",
      marketing: consent?.marketing === "granted",
    });
  }, [customizeOpen, consent]);

  const openFromFooter = useCallback(() => {
    setVisible(true);
    setCustomizeOpen(true);
  }, []);
  usePrivacySettingsEvent(openFromFooter);

  if (!visible || !settings) return null;

  function finish(analytics, marketing) {
    updateConsentChoice({ analytics, marketing });
    setVisible(false);
    setCustomizeOpen(false);
  }

  const privacyPolicyUrl = settings.consent?.privacyPolicyUrl;
  const compactDescription = "FinePro memakai cookie esensial, analitik, dan iklan untuk meningkatkan layanan.";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] px-2.5 pb-[calc(8px+env(safe-area-inset-bottom))] sm:px-5 md:bottom-4 md:px-6 md:pb-0">
      <section
        role="region"
        aria-label="Pengaturan cookie"
        aria-live="polite"
        className={`pointer-events-auto mx-auto w-full animate-auth-slide-up overflow-y-auto rounded-2xl border border-neutral-border bg-white p-3 shadow-[0_14px_36px_rgba(15,31,61,0.18)] sm:p-5 md:rounded-2xl ${
          customizeOpen ? "max-w-4xl" : "max-w-6xl"
        }`}
        style={{ maxHeight: "min(46dvh, 560px)" }}
      >
        {!customizeOpen ? (
          <div className="items-start gap-4 md:flex md:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-2.5 md:gap-3.5">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-violet-light text-violet md:h-11 md:w-11 md:rounded-2xl" aria-hidden="true">
                <Cookie size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-navy md:text-lg">Pengaturan cookie</h2>
                <p id="cookie-consent-description" className="mt-1 text-xs font-medium leading-5 text-neutral-600 md:text-sm md:leading-6">
                  <span className="md:hidden">{compactDescription}</span>
                  <span className="hidden md:inline">Kami menggunakan cookie analitik dan iklan untuk memahami penggunaan FinePro dan meningkatkan layanan. Cookie esensial selalu aktif.</span>
                </p>
                {privacyPolicyUrl && (
                  <a href={privacyPolicyUrl} className="mt-1 inline-block text-xs font-bold text-violet underline decoration-2 underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 md:mt-1.5 md:text-sm">
                    Baca kebijakan privasi
                  </a>
                )}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:mt-0 md:w-auto md:min-w-[520px] md:gap-2.5">
              <button type="button" onClick={() => finish("denied", "denied")} className="flex min-h-[42px] w-full items-center justify-center rounded-full bg-navy px-3 text-xs font-bold text-white shadow-[0_12px_24px_rgba(15,31,61,0.16)] focus:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 md:min-h-[48px] md:px-5 md:text-sm md:whitespace-nowrap">
                Tolak non-esensial
              </button>
              <button type="button" onClick={() => finish("granted", "granted")} className="flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-full bg-violet px-3 text-xs font-bold text-white shadow-[0_12px_24px_rgba(111,85,242,0.22)] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 md:min-h-[48px] md:gap-2 md:px-5 md:text-sm md:whitespace-nowrap">
                <ShieldCheck size={17} aria-hidden="true" /> Terima semua
              </button>
              <button type="button" onClick={() => setCustomizeOpen(true)} className="col-span-2 flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-full bg-neutral-100 px-3 text-xs font-bold text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 sm:col-span-1 md:min-h-[48px] md:gap-2 md:px-5 md:text-sm md:whitespace-nowrap">
                <Settings2 size={17} aria-hidden="true" /> Atur preferensi
              </button>
            </div>
          </div>
        ) : (
          <div
            role="group"
            aria-describedby="cookie-consent-description"
            className="space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-navy md:text-lg">Preferensi cookie</h2>
                <p id="cookie-consent-description" className="mt-1 text-xs leading-5 text-neutral-600 md:text-sm md:leading-6">Pilih cookie non-esensial yang kamu izinkan.</p>
              </div>
              {consent && (
                <button type="button" onClick={() => { setVisible(false); setCustomizeOpen(false); }} aria-label="Tutup pengaturan cookie" className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet md:h-11 md:w-11">
                  <X size={18} aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <CategoryRow title="Esensial" description="Diperlukan untuk login, keamanan sesi, dan fungsi inti. Selalu aktif." checked disabled onChange={() => {}} />
              <CategoryRow title="Analitik" description="Membantu memahami penggunaan FinePro melalui Google Analytics." checked={choices.analytics} onChange={(value) => setChoices((prev) => ({ ...prev, analytics: value }))} />
              <CategoryRow title="Marketing" description="Mengukur efektivitas iklan melalui Meta Pixel." checked={choices.marketing} onChange={(value) => setChoices((prev) => ({ ...prev, marketing: value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:ml-auto sm:max-w-sm">
              <button type="button" onClick={() => finish(choices.analytics ? "granted" : "denied", choices.marketing ? "granted" : "denied")} className="flex min-h-[42px] w-full items-center justify-center rounded-full bg-violet px-3 text-xs font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 md:min-h-[48px] md:text-sm">
                Simpan
              </button>
              <button type="button" onClick={() => setCustomizeOpen(false)} className="flex min-h-[42px] w-full items-center justify-center rounded-full border-2 border-neutral-300 bg-white px-3 text-xs font-bold text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 md:min-h-[48px] md:text-sm">
                Kembali
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
