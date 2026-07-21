// src/api/tracking.js
// Public tracking endpoints (tanpa auth) — dipanggil TrackingProvider.
import { API_BASE } from "./apiClient.js";

async function trackingFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }
  return data?.data ?? {};
}

export async function getPublicTrackingSettings() {
  return trackingFetch("/tracking/public-settings");
}

export async function sendAttributionTouch(payload) {
  return trackingFetch("/tracking/attribution", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
