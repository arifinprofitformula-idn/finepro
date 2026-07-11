// src/lib/households.js
// Household management via API lokal

import { apiFetch } from "./apiClient.js";

export async function getMyHousehold(userId) {
  const data = await apiFetch('/households');
  const households = data.households || [];
  return households.length > 0 ? households[0] : null;
}

export async function createHousehold(ownerId, householdType, name) {
  const data = await apiFetch('/households', {
    method: 'POST',
    body: JSON.stringify({
      name: name || defaultNameForType(householdType),
      household_type: householdType,
    }),
  });
  return data.household;
}

export async function updateMonthlyIncomeDay(day) {
  const data = await apiFetch('/households/me', {
    method: 'PATCH',
    body: JSON.stringify({ monthly_income_day: day }),
  });
  return data.household;
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
