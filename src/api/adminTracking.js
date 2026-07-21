// src/api/adminTracking.js
// Client untuk /api/admin/tracking/* — dipakai Tracking tab di AdminPage.jsx.
// Memakai adminFetch (token admin + auto-logout di 401) yang sama dengan src/api/admin.js.
import { API_BASE } from "./apiClient.js";
import { getAdminToken, setAdminToken } from "./admin.js";

async function adminTrackingFetch(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...options.headers };
  const token = getAdminToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const text = await res.text();
  let json = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { success: false, error: { message: text } };
    }
  }

  if (res.status === 401) setAdminToken(null);
  if (!json.success) {
    const err = new Error(json?.error?.message || `Request tracking admin gagal (${res.status})`);
    err.code = json?.error?.code;
    throw err;
  }
  return json.data;
}

export async function getTrackingSettings() {
  return adminTrackingFetch("/admin/tracking/settings");
}

export async function updateTrackingSettings(patch) {
  const data = await adminTrackingFetch("/admin/tracking/settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return data.settings;
}

export async function clearTrackingSecret(field) {
  const data = await adminTrackingFetch(`/admin/tracking/settings/secrets/${field}/clear`, { method: "POST" });
  return data.settings;
}

export async function clearMetaTestEventCode() {
  const data = await adminTrackingFetch("/admin/tracking/meta/clear-test-event-code", { method: "POST" });
  return data.settings;
}

export async function testMetaCapi() {
  return adminTrackingFetch("/admin/tracking/test-meta", { method: "POST" });
}

export async function validateGa4Payload() {
  return adminTrackingFetch("/admin/tracking/validate-ga4", { method: "POST" });
}

export async function sendGa4RealtimeTest() {
  return adminTrackingFetch("/admin/tracking/send-ga4-test", { method: "POST" });
}

export async function updateEventMapping(eventMapping) {
  const data = await adminTrackingFetch("/admin/tracking/event-mapping", {
    method: "PATCH",
    body: JSON.stringify({ eventMapping }),
  });
  return data.eventMapping;
}

export async function resetEventMapping() {
  const data = await adminTrackingFetch("/admin/tracking/event-mapping/reset", { method: "POST" });
  return data.eventMapping;
}

export async function getTrackingLogs(params = {}) {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ""))
  );
  return adminTrackingFetch(`/admin/tracking/logs?${query}`);
}
