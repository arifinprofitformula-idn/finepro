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
