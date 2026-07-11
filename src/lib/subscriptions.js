// src/lib/subscriptions.js
// Baca status langganan — via API (subscription ada di response households)

import { apiFetch } from "./apiClient.js";

export const PLAN_LABELS = {
  trial: "Trial",
  monthly: "Bulanan",
  semiannual: "6 Bulan",
  annual: "Tahunan"
};

export async function getSubscription(householdId) {
  try {
    const data = await apiFetch('/households');
    const h = (data.households || []).find(h => h.id === householdId);
    if (h) {
      // Query subscription via households data
      // Sementara return default trial
      return { plan: 'trial', status: 'active', current_period_end: null };
    }
  } catch {}
  return { plan: 'trial', status: 'active', current_period_end: null };
}

export function planLabel(subscription) {
  if (!subscription) return "Trial";
  const label = PLAN_LABELS[subscription.plan] || subscription.plan;
  return subscription.status !== "active" ? `${label} (Nonaktif)` : label;
}
