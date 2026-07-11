// src/lib/subscriptions.js
// Helper tampilan status langganan. Data langganan (plan, subscription_status,
// current_period_end) sudah ikut dikirim GET /households (lihat
// api/routes/households.js) — jadi tidak perlu API call terpisah di sini.

export const PLAN_LABELS = {
  trial: "Trial",
  monthly: "Bulanan",
  semiannual: "6 Bulan",
  annual: "Tahunan"
};

// household: objek dari getMyHousehold(), berisi plan/subscription_status/current_period_end
export function planLabel(household) {
  if (!household || !household.plan) return "Trial";
  const label = PLAN_LABELS[household.plan] || household.plan;
  return household.subscription_status !== "active" ? `${label} (Nonaktif)` : label;
}
