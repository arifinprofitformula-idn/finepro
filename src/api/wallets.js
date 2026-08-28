// src/api/wallets.js
// Multi-dompet & transfer antar dompet via API lokal

import { apiFetch } from "./apiClient.js";

export async function getWallets() {
  const data = await apiFetch('/wallets');
  return data.wallets || [];
}

export async function createWallet(name) {
  const data = await apiFetch('/wallets', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return data.wallet;
}

export async function transferBetweenWallets({ from_wallet_id, to_wallet_id, amount, note }) {
  const data = await apiFetch('/wallets/transfer', {
    method: 'POST',
    body: JSON.stringify({ from_wallet_id, to_wallet_id, amount, note }),
  });
  return data.transfer;
}


export async function reconcileWallet({ walletId, actual_balance, reason, note, idempotency_key }) {
  const data = await apiFetch(`/wallets/${walletId}/reconcile`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotency_key },
    body: JSON.stringify({ actual_balance, reason, note, idempotency_key }),
  });
  return data.reconciliation;
}

export async function getWalletReconciliations(walletId, limit = 20) {
  const data = await apiFetch(`/wallets/${walletId}/reconciliations?limit=${limit}`);
  return data.reconciliations || [];
}

export async function reverseWalletReconciliation(reconciliationId) {
  const data = await apiFetch(`/wallets/reconciliations/${reconciliationId}/reverse`, { method: 'POST' });
  return data.reconciliation;
}
