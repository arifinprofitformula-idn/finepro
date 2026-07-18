// src/lib/payments.js
// Upgrade langganan lewat gateway aktif (Manual / Midtrans / Xendit) — endpoint
// di api/routes/payments.js. Gateway aktif ditentukan admin di Admin Console.
// Harga & status promo Early Access dihitung live di backend (lihat getPricing()),
// tidak lagi di-hardcode di sini supaya harga otomatis kembali normal saat promo habis.

import { apiFetch } from "./apiClient.js";

// { plans: { quarterly, annual, lifetime }, topup, aiQuota, aiCredit } — tiap plan:
// { amount, months, label, isPromo }
export async function getPricing() {
  return apiFetch('/payments/pricing');
}

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

// Top-Up Kredit AI — khusus household paket Lifetime, opt-in, harga tetap.
export async function createAiCreditTopup() {
  return apiFetch('/payments/ai-credit-topup/create', { method: 'POST' });
}

export async function submitManualAiCreditTopup({ reference, note, file }) {
  const formData = new FormData();
  if (reference) formData.append('reference', reference);
  if (note) formData.append('note', note);
  formData.append('proof', file);

  const data = await apiFetch('/payments/ai-credit-topup/manual/submit', {
    method: 'POST',
    body: formData,
  });
  return data.payment;
}

// { features: { receipt_scan: {balance, granted_total}, ai_insight: {...}, ... } }
export async function getAiCreditBalances() {
  const data = await apiFetch('/payments/ai-credit/balance');
  return data.features || {};
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
