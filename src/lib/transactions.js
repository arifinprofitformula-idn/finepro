// src/lib/transactions.js
// CRUD transaksi keuangan, dibatasi otomatis oleh RLS ke household milik user.

import { supabase } from "./supabaseClient.js";

export async function getMonthTransactions(householdId, monthKey) {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("household_id", householdId)
    .gte("date", monthKey + "-01")
    .lte("date", monthKey + "-31")
    .order("date", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function addTransaction({ householdId, userId, date, type, category, amount, note }) {
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      household_id: householdId,
      created_by: userId,
      date, type, category, amount, note
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTransaction(id) {
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;
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
