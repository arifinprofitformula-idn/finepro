// src/api/receipts.js
// Scan struk (Claude vision) + kuota bulanan — dipindah dari
// src/api/transactions.js supaya satu rumah dengan backend api/routes/receipts.js.

import { apiFetch, getToken } from "./apiClient.js";

// FormData, bukan JSON, jadi tidak lewat apiFetch — sama pola dengan uploadAvatar.
export async function scanReceipt(file) {
  const token = getToken();
  const formData = new FormData();
  formData.append('receipt', file);

  const res = await fetch('/api/receipts/scan', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gagal memindai struk');
  }
  return data;
}

export async function getScanQuota() {
  return apiFetch('/receipts/quota');
}
