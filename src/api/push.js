// src/api/push.js
// Aktivasi notifikasi push budget dari browser

import { apiFetch } from "./apiClient.js";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window;
}

export async function getPushPermissionState() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission; // "default" | "granted" | "denied"
}

export async function subscribeToPush() {
  if (!(await isPushSupported())) {
    throw new Error("Browser ini tidak mendukung notifikasi push");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Izin notifikasi ditolak");
  }

  const registration = await navigator.serviceWorker.ready;
  const { publicKey } = await apiFetch("/push/vapid-public-key");
  if (!publicKey) {
    throw new Error("Notifikasi belum dikonfigurasi di server");
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const json = subscription.toJSON();
  await apiFetch("/push/subscribe", {
    method: "POST",
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });

  return true;
}
