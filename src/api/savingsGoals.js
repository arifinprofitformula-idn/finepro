import { apiFetch } from "./apiClient.js";

export async function getSavingsGoals(status = "active") {
  const data = await apiFetch(`/savings-goals?status=${encodeURIComponent(status)}`);
  return data.goals || [];
}

export async function createSavingsGoal(payload) {
  const data = await apiFetch("/savings-goals", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.goal;
}

export async function updateSavingsGoal(id, payload) {
  const data = await apiFetch(`/savings-goals/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return data.goal;
}

export async function addSavingsContribution(goalId, payload) {
  const data = await apiFetch(`/savings-goals/${goalId}/contributions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.goal;
}

export async function archiveSavingsGoal(id) {
  await apiFetch(`/savings-goals/${id}`, { method: "DELETE" });
}
