import { API_BASE } from "./apiClient.js";

const ADMIN_TOKEN_KEY = "finepro_admin_token";

let _adminToken = localStorage.getItem(ADMIN_TOKEN_KEY);

export function setAdminToken(token) {
  _adminToken = token;
  if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
  else localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function getAdminToken() {
  return _adminToken;
}

async function adminFetch(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (_adminToken) {
    headers.Authorization = `Bearer ${_adminToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  const text = await res.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (res.status === 401 && _adminToken) {
    setAdminToken(null);
  }
  if (!res.ok) {
    throw new Error(data.error || `Request admin gagal (${res.status})`);
  }
  return data;
}

export async function adminLogin(email, password) {
  const data = await adminFetch("/admin/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setAdminToken(data.token);
  return data.user;
}

export async function adminLogout() {
  setAdminToken(null);
}

export async function getCurrentAdmin() {
  if (!_adminToken) return null;
  try {
    const data = await adminFetch("/admin/me");
    return data.user;
  } catch {
    return null;
  }
}

export async function getAdminOverview() {
  const data = await adminFetch("/admin/overview");
  return data.overview;
}

export async function getAdminSettings() {
  const data = await adminFetch("/admin/settings");
  return data.settings;
}

export async function updateAdminSetting(key, patch) {
  const data = await adminFetch(`/admin/settings/${key}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return data.setting;
}

export async function testApeEpiConnection(patch = {}) {
  const data = await adminFetch("/admin/ape-epi/test", {
    method: "POST",
    body: JSON.stringify(patch),
  });
  return data.prices;
}

export async function getAdminUsers(q = "") {
  const query = q ? `?q=${encodeURIComponent(q)}` : "";
  const data = await adminFetch(`/admin/users${query}`);
  return data.users || [];
}

export async function updateAdminUserRole(id, role) {
  const data = await adminFetch(`/admin/users/${id}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
  return data.user;
}

export async function getAdminHouseholds() {
  const data = await adminFetch("/admin/households");
  return data.households || [];
}

export async function getAdminPayments() {
  const data = await adminFetch("/admin/payments");
  return data.payments || [];
}

export async function getAdminAuditLogs() {
  const data = await adminFetch("/admin/audit-logs");
  return data.logs || [];
}
