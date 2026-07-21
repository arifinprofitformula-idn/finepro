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

// Registrasi service worker otomatis (vite-plugin-pwa)
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
