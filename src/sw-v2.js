// src/sw.js
// Service worker custom (mode injectManifest) — vite-plugin-pwa hanya
// menyuntik precache manifest ke self.__WB_MANIFEST, sisanya kita tulis
// sendiri supaya bisa nambah push/notificationclick handler untuk
// notifikasi budget (tidak bisa dilakukan di mode generateSW lama).

import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkOnly } from "workbox-strategies";

precacheAndRoute(self.__WB_MANIFEST);

// Sama seperti sebelumnya: jangan pernah cache panggilan API, data
// transaksi/household harus selalu dari jaringan, bukan basi dari cache.
registerRoute(
  ({ url }) => url.pathname.startsWith("/api/"),
  new NetworkOnly()
);

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "FinePro", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "FinePro";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/" }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientsArr) => {
      const existing = clientsArr.find((c) => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return self.clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
