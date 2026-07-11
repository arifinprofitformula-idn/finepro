// src/lib/subscriptions.js
// Baca status langganan household. Penulisan status (upgrade plan)
// masih manual dari Supabase Dashboard di fase ini — payment gateway
// otomatis baru masuk di Fase 6 roadmap.

import { supabase } from "./supabaseClient.js";

export const PLAN_LABELS = {
  trial: "Trial",
  monthly: "Bulanan",
  semiannual: "6 Bulan",
  annual: "Tahunan"
};

export async function getSubscription(householdId) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end")
    .eq("household_id", householdId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export function planLabel(subscription) {
  if (!subscription) return "Trial";
  const label = PLAN_LABELS[subscription.plan] || subscription.plan;
  return subscription.status !== "active" ? `${label} (Nonaktif)` : label;
}
