// src/lib/categories.js
// Ambil kategori dari database (bukan hardcode), sesuai household_type
// (family / student / individual). Kategori otomatis di-seed oleh trigger
// database saat household dibuat — lihat supabase/migrations/002_add_persona_categories.sql

import { supabase } from "./supabaseClient.js";

export async function getCategories(householdId, type) {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, sort_order")
    .eq("household_id", householdId)
    .eq("type", type)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data;
}

export async function getAllCategories(householdId) {
  const { data, error } = await supabase
    .from("categories")
    .select("id, type, name, sort_order")
    .eq("household_id", householdId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data;
}

export async function addCustomCategory(householdId, type, name) {
  const { data, error } = await supabase
    .from("categories")
    .insert({ household_id: householdId, type, name, is_default: false, sort_order: 99 })
    .select()
    .single();

  if (error) throw error;
  return data;
}
