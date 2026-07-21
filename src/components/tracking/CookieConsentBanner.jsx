// src/components/tracking/CookieConsentBanner.jsx
// Banner consent cookie — mobile responsive, aksesibel (role, aria-live,
// keyboard nav lewat Dialog headlessui yang trap focus otomatis), tidak
// memakai dark pattern (semua pilihan sama besar/menonjol, "Tolak" bukan
// tombol kecil tersembunyi). Bisa dibuka ulang lewat tombol "Pengaturan
// Privasi" di footer (lihat openPrivacySettings() di TrackingProvider.jsx).

import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { Cookie, Settings2, ShieldCheck, X } from "lucide-react";
import { useTracking, usePrivacySettingsEvent } from "./TrackingProvider.jsx";

function CategoryRow({ title, description, checked, disabled, onChange }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-neutral-border/70 bg-white/70 p-3">
      <div className="min-w-0">
        <div className="text-sm font-bold text-navy">{title}</div>
        <p className="mt-0.5 text-xs font-medium leading-relaxed text-neutral-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative flex h-7 w-12 flex-shrink-0 items-center rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 ${
          checked ? "border-violet bg-violet" : "border-neutral-border bg-neutral-200"
        } ${disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

export default function CookieConsentBanner() {
  const { settings, bannerShouldShow, updateConsentChoice } = useTracking();
  const [visible, setVisible] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [choices, setChoices] = useState({ analytics: false, marketing: false });

  useEffect(() => {
    setVisible(Boolean(bannerShouldShow));
  }, [bannerShouldShow]);

  const openFromFooter = useCallback(() => {
    setVisible(true);
    setCustomizeOpen(true);
  }, []);
  usePrivacySettingsEvent(openFromFooter);

  if (!visible || !settings) return null;

  function handleAcceptAll() {
    updateConsentChoice({ analytics: "granted", marketing: "granted" });
    setVisible(false);
    setCustomizeOpen(false);
  }

  function handleRejectNonEssential() {
    updateConsentChoice({ analytics: "denied", marketing: "denied" });
    setVisible(false);
    setCustomizeOpen(false);
  }

  function handleSavePreferences() {
    updateConsentChoice({
      analytics: choices.analytics ? "granted" : "denied",
      marketing: choices.marketing ? "granted" : "denied",
    });
    setVisible(false);
    setCustomizeOpen(false);
  }

  const title = settings.consent?.bannerTitle || "Kami menghargai privasi kamu";
  const description =
    settings.consent?.bannerDescription ||
    "FinePro menggunakan cookie untuk analitik dan iklan agar pengalaman kamu lebih baik. Kamu bisa memilih kategori cookie yang diizinkan.";

  return (
    <>
      <div
        role="region"
        aria-label="Pemberitahuan cookie"
        className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-4 sm:pb-4"
      >
        <div className="mx-auto max-w-2xl animate-auth-slide-up">
          <div className="gloss-panel rounded-[26px] p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-violet-light text-violet">
                <Cookie size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-navy">{title}</h2>
                <p className="mt-1 text-xs font-medium leading-relaxed text-neutral-500">{description}</p>
                {settings.consent?.privacyPolicyUrl && (
                  <a
                    href={settings.consent.privacyPolicyUrl}
                    className="mt-1 inline-block text-xs font-bold text-violet underline focus:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2"
                  >
                    Baca kebijakan privasi
                  </a>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleAcceptAll}
                    className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-full bg-violet px-4 text-xs font-bold text-white shadow-[0_14px_28px_rgba(111,85,242,0.26)] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2"
                  >
                    <ShieldCheck size={15} />
                    Terima Semua
                  </button>
                  <button
                    type="button"
                    onClick={handleRejectNonEssential}
                    className="flex min-h-[42px] flex-1 items-center justify-center rounded-full border border-neutral-border bg-white/70 px-4 text-xs font-bold text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2"
                  >
                    Tolak Non-Esensial
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomizeOpen(true)}
                    className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-full border border-neutral-border bg-white/70 px-4 text-xs font-bold text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2"
                  >
                    <Settings2 size={15} />
                    Atur Preferensi
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={customizeOpen} onClose={() => setCustomizeOpen(false)} className="relative z-[60]">
        <div className="fixed inset-0 bg-navy/40 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="gloss-panel w-full max-w-md rounded-[26px] p-5">
            <div className="flex items-start justify-between gap-3">
              <DialogTitle className="text-base font-bold text-navy">Pengaturan Privasi</DialogTitle>
              <button
                type="button"
                onClick={() => setCustomizeOpen(false)}
                aria-label="Tutup pengaturan privasi"
                className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition hover:bg-white/70 hover:text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-violet"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              <CategoryRow
                title="Diperlukan"
                description="Wajib agar FinePro dapat berfungsi (login, keamanan sesi). Selalu aktif."
                checked
                disabled
                onChange={() => {}}
              />
              <CategoryRow
                title="Analitik"
                description="Membantu kami memahami penggunaan aplikasi lewat Google Analytics."
                checked={choices.analytics}
                onChange={(value) => setChoices((prev) => ({ ...prev, analytics: value }))}
              />
              <CategoryRow
                title="Marketing"
                description="Digunakan untuk mengukur efektivitas iklan lewat Meta Pixel."
                checked={choices.marketing}
                onChange={(value) => setChoices((prev) => ({ ...prev, marketing: value }))}
              />
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleSavePreferences}
                className="flex min-h-[42px] flex-1 items-center justify-center rounded-full bg-violet px-4 text-xs font-bold text-white shadow-[0_14px_28px_rgba(111,85,242,0.26)] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2"
              >
                Simpan Preferensi
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="flex min-h-[42px] items-center justify-center rounded-full border border-neutral-border bg-white/70 px-4 text-xs font-bold text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2"
              >
                Terima Semua
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}
