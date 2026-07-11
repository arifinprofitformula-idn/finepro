// src/lib/transactions.js
// CRUD transaksi via API lokal

import { apiFetch, getToken } from "./apiClient.js";

export async function getMonthTransactions(householdId, monthKey) {
  const [year, month] = monthKey.split('-');
  const data = await apiFetch(`/transactions?month=${month}&year=${year}`);
  return data.transactions || [];
}

export async function addTransaction({ householdId, userId, date, type, category, amount, note }) {
  const data = await apiFetch('/transactions', {
    method: 'POST',
    body: JSON.stringify({ date, type, category, amount, note }),
  });
  return data.transaction;
}

export async function deleteTransaction(id) {
  await apiFetch(`/transactions/${id}`, { method: 'DELETE' });
}

// Export CSV bukan lewat apiFetch karena responsnya file, bukan JSON —
// fetch manual supaya tetap bisa kirim header Authorization (bukan link biasa).
export async function exportMonthCSV(monthKey) {
  const token = getToken();
  const res = await fetch(`/api/transactions/export?month=${monthKey}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Gagal export data');
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transaksi-${monthKey}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function getContributions(monthKey) {
  const data = await apiFetch(`/transactions/contributions?month=${monthKey}`);
  return data.contributions || [];
}

export function summarize(transactions) {
  const income = transactions.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  return { income, expense };
}

export function groupExpenseByCategory(transactions) {
  const byCat = {};
  transactions.filter(t => t.type === "expense").forEach(t => {
    byCat[t.category] = (byCat[t.category] || 0) + Number(t.amount);
  });
  return byCat;
}
