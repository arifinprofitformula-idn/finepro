import { apiFetch } from "./apiClient.js";

export async function getAdminOverview() {
  const data = await apiFetch("/admin/overview");
  return data.overview;
}

export async function getAdminSettings() {
  const data = await apiFetch("/admin/settings");
  return data.settings;
}

export async function updateAdminSetting(key, patch) {
  const data = await apiFetch(`/admin/settings/${key}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return data.setting;
}

export async function getAdminUsers(q = "") {
  const query = q ? `?q=${encodeURIComponent(q)}` : "";
  const data = await apiFetch(`/admin/users${query}`);
  return data.users || [];
}

export async function updateAdminUserRole(id, role) {
  const data = await apiFetch(`/admin/users/${id}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
  return data.user;
}

export async function getAdminHouseholds() {
  const data = await apiFetch("/admin/households");
  return data.households || [];
}

export async function getAdminPayments() {
  const data = await apiFetch("/admin/payments");
  return data.payments || [];
}

export async function getAdminAuditLogs() {
  const data = await apiFetch("/admin/audit-logs");
  return data.logs || [];
}
