// src/lib/payments.js
// Upgrade langganan lewat gateway aktif (Manual / Midtrans / Xendit) — endpoint
// di api/routes/payments.js. Gateway aktif ditentukan admin di Admin Console.

import { apiFetch } from "./apiClient.js";

export const PLANS = [
  { id: "monthly", label: "Bulanan", price: 29000, priceLabel: "Rp 29.000 / bulan" },
  { id: "semiannual", label: "6 Bulan", price: 149000, priceLabel: "Rp 149.000 / 6 bulan" },
  { id: "annual", label: "Tahunan", price: 249000, priceLabel: "Rp 249.000 / tahun" },
];

// Untuk Midtrans: { orderId, token, redirectUrl }. Untuk Xendit: { orderId, invoiceUrl }.
export async function createPayment(plan) {
  return apiFetch('/payments/create', {
    method: 'POST',
    body: JSON.stringify({ plan }),
  });
}

export async function submitManualPayment({ plan, reference, note, file }) {
  const formData = new FormData();
  formData.append('plan', plan);
  if (reference) formData.append('reference', reference);
  if (note) formData.append('note', note);
  formData.append('proof', file);

  const data = await apiFetch('/payments/manual/submit', {
    method: 'POST',
    body: formData,
  });
  return data.payment;
}

// Return: { active: 'manual'|'midtrans'|'xendit', methods: { midtrans, xendit, manual } }
export async function getPaymentMethods() {
  const data = await apiFetch('/payments/methods');
  return { active: data.active, ...(data.methods || {}) };
}

export async function getPaymentStatus(orderId) {
  const data = await apiFetch(`/payments/status/${orderId}`);
  return data.payment;
}

export const PAYMENT_STATUS_LABELS = {
  paid: "Berhasil",
  pending: "Menunggu",
  failed: "Gagal",
  rejected: "Ditolak"
};

export async function getPaymentHistory() {
  const data = await apiFetch('/payments/history');
  return data.payments || [];
}
