import { useEffect, useState } from "react";
import { Download, Home, Smartphone, X } from "lucide-react";
import {
  hasNativeInstallPrompt,
  markInstallDismissed,
  runNativeInstallPrompt,
  shouldShowInstallPopup,
  subscribeInstallState
} from "../utils/pwaInstall.js";

export default function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [showManualHelp, setShowManualHelp] = useState(false);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeInstallState(() => forceUpdate((value) => value + 1));
    const timer = setTimeout(() => {
      setVisible(shouldShowInstallPopup());
    }, 900);

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!shouldShowInstallPopup()) {
      setVisible(false);
    }
  });

  async function handleInstallNow() {
    const result = await runNativeInstallPrompt();
    if (!result.supported) {
      setShowManualHelp(true);
      return;
    }
    if (result.outcome === "accepted") {
      setVisible(false);
    }
  }

  function handleLater() {
    markInstallDismissed();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-[82px] z-40 px-4">
      <div className="mx-auto max-w-lg animate-auth-slide-up">
        <div className="gloss-panel rounded-[26px] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-violet-light text-violet">
              <Smartphone size={19} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-navy">Install Finepro di perangkat?</h2>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-neutral-500">
                    Akses lebih cepat dari layar utama, tetap terasa seperti aplikasi.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLater}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-neutral-400 transition hover:bg-white/70 hover:text-navy"
                  aria-label="Tutup pilihan install"
                >
                  <X size={16} />
                </button>
              </div>

              {showManualHelp && (
                <div className="mt-3 rounded-2xl border border-neutral-border/70 bg-white/65 px-3 py-2 text-xs font-semibold leading-relaxed text-neutral-600">
                  <div className="mb-1 flex items-center gap-1.5 text-violet">
                    <Home size={14} />
                    Install manual
                  </div>
                  Android: buka menu browser lalu pilih <span className="text-navy">Tambahkan ke layar utama</span>.
                  iPhone: tekan Share lalu <span className="text-navy">Add to Home Screen</span>.
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleInstallNow}
                  className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-full bg-violet px-4 text-xs font-bold text-white shadow-[0_14px_28px_rgba(111,85,242,0.26)]"
                >
                  <Download size={15} />
                  {hasNativeInstallPrompt() ? "Install sekarang" : "Lihat cara install"}
                </button>
                <button
                  type="button"
                  onClick={handleLater}
                  className="flex min-h-[42px] items-center justify-center rounded-full border border-neutral-border bg-white/70 px-4 text-xs font-bold text-neutral-500"
                >
                  Nanti
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
