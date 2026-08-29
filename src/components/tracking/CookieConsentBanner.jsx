// src/components/tracking/CookieConsentBanner.jsx
// Consent modal mobile-first: solid surface, equal-effort choices, focus trap,
// responsive safe area, and persistent preferences via TrackingProvider.

import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { Cookie, Settings2, ShieldCheck, X } from "lucide-react";
import { useTracking, usePrivacySettingsEvent } from "./TrackingProvider.jsx";

function CategoryRow({ title, description, checked, disabled, onChange }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-neutral-border bg-neutral-50 p-3.5">
      <div className="min-w-0 pr-2">
        <div className="text-sm font-bold text-navy">{title}</div>
        <p className="mt-1 text-xs font-medium leading-5 text-neutral-600">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative flex h-8 w-14 flex-shrink-0 items-center rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 ${
          checked ? "border-violet bg-violet" : "border-neutral-300 bg-neutral-200"
        } ${disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
      >
        <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
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

  return (
    <Dialog open={visible} onClose={() => {}} className="relative z-[70]">
      <div className="fixed inset-0 bg-navy/50 backdrop-blur-[2px]" aria-hidden="true" />
      <div className="fixed inset-0 flex items-end justify-center overflow-y-auto p-4 sm:items-center">
        <DialogPanel
          role="dialog"
          aria-modal="true"
          aria-describedby="cookie-consent-description"
          className="w-full max-w-lg animate-auth-slide-up overflow-y-auto rounded-[28px] border border-white bg-white p-5 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-[0_28px_80px_rgba(15,31,61,0.32)] sm:p-6 sm:pb-6"
          style={{ maxHeight: "min(82dvh, 680px)" }}
        >
          {!customizeOpen ? (
            <>
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-violet-light text-violet" aria-hidden="true">
                  <Cookie size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-lg font-bold text-navy">Pengaturan cookie</DialogTitle>
                  <p id="cookie-consent-description" className="mt-2 text-sm font-medium leading-6 text-neutral-600">
                    Kami menggunakan cookie analitik dan iklan untuk memahami penggunaan FinePro dan meningkatkan layanan. Cookie esensial selalu aktif.
                  </p>
                  <p className="mt-2 text-sm font-medium leading-6 text-neutral-600">
                    Kamu dapat menerima, menolak, atau mengatur cookie non-esensial.
                  </p>
                  {privacyPolicyUrl && (
                    <a href={privacyPolicyUrl} className="mt-2 inline-block text-sm font-bold text-violet underline decoration-2 underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2">
                      Baca kebijakan privasi
                    </a>
                  )}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <button type="button" onClick={() => finish("denied", "denied")} className="flex min-h-[48px] w-full items-center justify-center rounded-full bg-navy px-5 text-sm font-bold text-white shadow-[0_14px_28px_rgba(15,31,61,0.18)] focus:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2">
                  Tolak non-esensial
                </button>
                <button type="button" onClick={() => finish("granted", "granted")} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-violet px-5 text-sm font-bold text-white shadow-[0_14px_28px_rgba(111,85,242,0.24)] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2">
                  <ShieldCheck size={17} aria-hidden="true" /> Terima semua
                </button>
                <button type="button" onClick={() => setCustomizeOpen(true)} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-neutral-100 px-5 text-sm font-bold text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 sm:col-span-2">
                  <Settings2 size={17} aria-hidden="true" /> Atur preferensi
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <DialogTitle className="text-lg font-bold text-navy">Preferensi cookie</DialogTitle>
                  <p id="cookie-consent-description" className="mt-1 text-sm leading-6 text-neutral-600">Pilih cookie non-esensial yang kamu izinkan.</p>
                </div>
                {consent && (
                  <button type="button" onClick={() => { setVisible(false); setCustomizeOpen(false); }} aria-label="Tutup pengaturan cookie" className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet">
                    <X size={18} aria-hidden="true" />
                  </button>
                )}
              </div>
              <div className="mt-4 space-y-3">
                <CategoryRow title="Esensial" description="Diperlukan untuk login, keamanan sesi, dan fungsi inti. Selalu aktif." checked disabled onChange={() => {}} />
                <CategoryRow title="Analitik" description="Membantu memahami penggunaan FinePro melalui Google Analytics." checked={choices.analytics} onChange={(value) => setChoices((prev) => ({ ...prev, analytics: value }))} />
                <CategoryRow title="Marketing" description="Mengukur efektivitas iklan melalui Meta Pixel." checked={choices.marketing} onChange={(value) => setChoices((prev) => ({ ...prev, marketing: value }))} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <button type="button" onClick={() => finish(choices.analytics ? "granted" : "denied", choices.marketing ? "granted" : "denied")} className="flex min-h-[48px] w-full items-center justify-center rounded-full bg-violet px-3 text-sm font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2">
                  Simpan
                </button>
                <button type="button" onClick={() => setCustomizeOpen(false)} className="flex min-h-[48px] w-full items-center justify-center rounded-full border-2 border-neutral-300 bg-white px-3 text-sm font-bold text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2">
                  Kembali
                </button>
              </div>
            </>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
