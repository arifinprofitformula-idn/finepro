// src/lib/payments.js
// Upgrade langganan via Midtrans Snap (endpoint di api/routes/payments.js)

import { apiFetch } from "./apiClient.js";

export const PLANS = [
  { id: "monthly", label: "Bulanan", price: 29000, priceLabel: "Rp 29.000 / bulan" },
  { id: "semiannual", label: "6 Bulan", price: 149000, priceLabel: "Rp 149.000 / 6 bulan" },
  { id: "annual", label: "Tahunan", price: 249000, priceLabel: "Rp 249.000 / tahun" },
];

export async function createPayment(plan) {
  return apiFetch('/payments/create', {
    method: 'POST',
    body: JSON.stringify({ plan }),
  });
}

export async function getPaymentStatus(orderId) {
  const data = await apiFetch(`/payments/status/${orderId}`);
  return data.payment;
}
