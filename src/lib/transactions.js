// src/lib/transactions.js
// CRUD transaksi via API lokal

import { apiFetch } from "./apiClient.js";

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
