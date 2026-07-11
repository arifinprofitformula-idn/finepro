// src/lib/categories.js
// Ambil kategori dari API lokal

import { apiFetch } from "./apiClient.js";

export async function getCategories(householdId, type) {
  const data = await apiFetch('/categories');
  return (data.categories || []).filter(c => c.type === type);
}

export async function getAllCategories(householdId) {
  const data = await apiFetch('/categories');
  return data.categories || [];
}

export async function addCustomCategory(householdId, type, name) {
  // Not yet implemented in API — placeholder
  return { id: Date.now().toString(), type, name, sort_order: 99, is_default: false };
}
