// src/api/bills.js
// Tagihan & pengingat jatuh tempo via API lokal

import { apiFetch } from "./apiClient.js";

export async function getBills() {
  const data = await apiFetch('/bills');
  return data.bills || [];
}

export async function getUpcomingBills() {
  const data = await apiFetch('/bills/upcoming');
  return data.bills || [];
}

export async function createBill({ name, amount, due_date, is_recurring, category }) {
  const data = await apiFetch('/bills', {
    method: 'POST',
    body: JSON.stringify({ name, amount, due_date, is_recurring, category }),
  });
  return data.bill;
}

export async function updateBill(id, { name, amount, due_date, is_recurring, category }) {
  const data = await apiFetch(`/bills/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name, amount, due_date, is_recurring, category }),
  });
  return data.bill;
}

export async function markBillPaid(id) {
  const data = await apiFetch(`/bills/${id}/mark-paid`, { method: 'POST' });
  return data.bill;
}

export async function deleteBill(id) {
  await apiFetch(`/bills/${id}`, { method: 'DELETE' });
}
