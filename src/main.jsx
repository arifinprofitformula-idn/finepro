import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.jsx";
import AdminConsole from "./AdminConsole.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import TrackingProvider from "./components/tracking/TrackingProvider.jsx";
import RouteChangeTracker from "./components/tracking/RouteChangeTracker.jsx";
import CookieConsentBanner from "./components/tracking/CookieConsentBanner.jsx";
import "./styles/tailwind.css";

// Registrasi service worker otomatis. Saat worker baru mengambil alih PWA yang
// sedang terbuka, reload satu kali agar UI tidak terus memakai precache lama.
const hadServiceWorkerController = Boolean(navigator.serviceWorker?.controller);
let reloadingForServiceWorkerUpdate = false;
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadServiceWorkerController && !reloadingForServiceWorkerUpdate) {
      reloadingForServiceWorkerUpdate = true;
      window.location.reload();
    }
  });
}
registerSW({ immediate: true });

const isAdminPath = window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/");
const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    {isAdminPath ? (
      <AdminConsole />
    ) : (
      <TrackingProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
        <RouteChangeTracker />
        <CookieConsentBanner />
      </TrackingProvider>
    )}
  </React.StrictMode>
);
