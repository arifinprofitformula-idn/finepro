// src/api/arisan.js
// Arisan & Iuran via API lokal. Peserta disimpan sebagai nama bebas
// (bukan user terdaftar) — arisan sering melibatkan tetangga/teman.

import { apiFetch } from "./apiClient.js";

export async function getArisanGroups() {
  const data = await apiFetch('/arisan');
  return data.groups || [];
}

export async function createArisanGroup({ name, amount_per_period, frequency_label }) {
  const data = await apiFetch('/arisan', {
    method: 'POST',
    body: JSON.stringify({ name, amount_per_period, frequency_label }),
  });
  return data.group;
}

export async function deleteArisanGroup(id) {
  await apiFetch(`/arisan/${id}`, { method: 'DELETE' });
}

export async function getArisanGroupDetail(groupId, period) {
  const query = period ? `?period=${period}` : '';
  return apiFetch(`/arisan/${groupId}${query}`);
}

export async function addArisanParticipant(groupId, participantName) {
  const data = await apiFetch(`/arisan/${groupId}/participants`, {
    method: 'POST',
    body: JSON.stringify({ participant_name: participantName }),
  });
  return data.participant;
}

export async function removeArisanParticipant(id) {
  await apiFetch(`/arisan/participants/${id}`, { method: 'DELETE' });
}

export async function toggleArisanPaid(participantId, periodLabel) {
  const data = await apiFetch(`/arisan/participants/${participantId}/toggle-paid`, {
    method: 'POST',
    body: JSON.stringify({ period_label: periodLabel }),
  });
  return data.paid;
}

// Ledger setoran & giliran menerima — pelengkap roster peserta di atas,
// mencatat histori nominal+tanggal bebas per anggota (lihat catatan di
// supabase/migrations/015_arisan_entries.sql).
export async function getArisanEntries(groupId) {
  const data = await apiFetch(`/arisan/${groupId}/entries`);
  return data.entries || [];
}

export async function addArisanEntry(groupId, { date, member_name, amount, is_payout }) {
  const data = await apiFetch(`/arisan/${groupId}/entries`, {
    method: 'POST',
    body: JSON.stringify({ date, member_name, amount, is_payout }),
  });
  return data.entry;
}

export async function deleteArisanEntry(id) {
  await apiFetch(`/arisan/entries/${id}`, { method: 'DELETE' });
}
