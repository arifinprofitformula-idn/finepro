// src/lib/households.js
// Household = unit keluarga/individu/mahasiswa yang memiliki data keuangan sendiri.
// Satu user bisa jadi anggota dari satu household (versi awal ini: 1 household per user).

import { supabase } from "./supabaseClient.js";

/**
 * Cek apakah user sudah tergabung dalam household.
 * Return household_id jika ada, null jika belum (berarti perlu onboarding).
 */
export async function getMyHousehold(userId) {
  const { data, error } = await supabase
    .from("household_members")
    .select("household_id, households(*)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? data.households : null;
}

/**
 * Buat household baru sesuai persona yang dipilih user saat onboarding.
 * Trigger di database otomatis: tambahkan user sebagai owner,
 * buat subscription trial 14 hari, dan seed kategori sesuai household_type.
 */
export async function createHousehold(ownerId, householdType, name) {
  const { data, error } = await supabase
    .from("households")
    .insert({
      owner_id: ownerId,
      household_type: householdType,
      name: name || defaultNameForType(householdType)
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

function defaultNameForType(type) {
  if (type === "family") return "Keluarga Saya";
  if (type === "student") return "Keuangan Kuliah";
  return "Keuangan Pribadi";
}

export const HOUSEHOLD_TYPE_LABELS = {
  family: "Keluarga / Suami-Istri",
  student: "Mahasiswa",
  individual: "Individu"
};
