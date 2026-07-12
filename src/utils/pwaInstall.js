const DISMISSED_KEY = "finepro-install-dismissed-at";
const INSTALLED_KEY = "finepro-install-installed";
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

let deferredPrompt = null;
const listeners = new Set();

function emit() {
  listeners.forEach((listener) => listener());
}

export function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator?.standalone === true
  );
}

export function isInstallMarkedDone() {
  return localStorage.getItem(INSTALLED_KEY) === "1";
}

export function isAppInstalled() {
  return isStandaloneMode() || isInstallMarkedDone();
}

export function hasNativeInstallPrompt() {
  return Boolean(deferredPrompt);
}

export function wasInstallPromptRecentlyDismissed() {
  const raw = Number(localStorage.getItem(DISMISSED_KEY) || 0);
  return raw > 0 && Date.now() - raw < DISMISS_COOLDOWN_MS;
}

export function shouldShowInstallPopup() {
  return !isAppInstalled() && !wasInstallPromptRecentlyDismissed();
}

export function markInstallDismissed() {
  localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  emit();
}

export function markInstallDone() {
  localStorage.setItem(INSTALLED_KEY, "1");
  localStorage.removeItem(DISMISSED_KEY);
  emit();
}

export async function runNativeInstallPrompt() {
  if (!deferredPrompt) return { supported: false, outcome: "manual" };

  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  promptEvent.prompt();

  const choice = await promptEvent.userChoice;
  if (choice?.outcome === "accepted") {
    markInstallDone();
  } else {
    markInstallDismissed();
  }
  emit();
  return { supported: true, outcome: choice?.outcome || "dismissed" };
}

export function subscribeInstallState(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    emit();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    markInstallDone();
  });

  if (isStandaloneMode()) {
    markInstallDone();
  }
}
