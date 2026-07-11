// src/lib/invites.js
// Undangan anggota household via API lokal

import { apiFetch } from "./apiClient.js";

export async function createInvite(email) {
  const data = await apiFetch('/invites', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  return data.invite;
}

export async function getMyPendingInvites() {
  const data = await apiFetch('/invites/mine');
  return data.invites || [];
}

export async function acceptInvite(inviteId) {
  return apiFetch(`/invites/${inviteId}/accept`, { method: 'POST' });
}
