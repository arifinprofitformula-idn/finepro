// src/api/categories.js
// CRUD kategori via API lokal

import { apiFetch } from "./apiClient.js";

export async function getCategories(householdId, type) {
  const data = await apiFetch('/categories');
  return (data.categories || []).filter(c => c.type === type);
}

export async function getAllCategories(householdId) {
  const data = await apiFetch('/categories');
  return data.categories || [];
}

export async function createCategory(type, name) {
  const data = await apiFetch('/categories', {
    method: 'POST',
    body: JSON.stringify({ type, name }),
  });
  return data.category;
}

export async function renameCategory(id, name) {
  const data = await apiFetch(`/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
  return data.category;
}

export async function deleteCategory(id) {
  await apiFetch(`/categories/${id}`, { method: 'DELETE' });
}
