// src/lib/budgets.js
// CRUD budget per kategori (fase pengembangan berikutnya di dashboard,
// backend-nya disiapkan lebih dulu agar siap dipakai).

import { supabase } from "./supabaseClient.js";

export async function getBudgets(householdId) {
  const { data, error } = await supabase
    .from("budgets")
    .select("category, amount")
    .eq("household_id", householdId);

  if (error) throw error;
  const map = {};
  (data || []).forEach(b => { map[b.category] = Number(b.amount); });
  return map;
}

export async function setBudget(householdId, category, amount) {
  const { error } = await supabase
    .from("budgets")
    .upsert({ household_id: householdId, category, amount, updated_at: new Date().toISOString() }, { onConflict: "household_id,category" });

  if (error) throw error;
}
