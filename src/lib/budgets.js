// src/lib/budgets.js
// CRUD budget via API lokal

import { apiFetch } from "./apiClient.js";

export async function getBudgets(householdId) {
  const data = await apiFetch('/budgets');
  const map = {};
  (data.budgets || []).forEach(b => { map[b.category] = Number(b.amount); });
  return map;
}

export async function setBudget(householdId, category, amount) {
  await apiFetch('/budgets', {
    method: 'PUT',
    body: JSON.stringify({ category, amount }),
  });
}
