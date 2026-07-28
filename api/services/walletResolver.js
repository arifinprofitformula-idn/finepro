// api/services/walletResolver.js
// Smart wallet matching — resolves wallet from payment method, bank name,
// account last4, or ewallet name. Uses wallet_identifiers table for personal mappings.

import pool from '../db.js';

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' dan ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PAYMENT_KEYWORD_MAP = {
  tunai: ['tunai', 'cash', 'uang'],
  qris: ['qris', 'qr'],
  debit: ['debit', 'bca', 'mandiri', 'bni', 'bri', 'bsi', 'bank'],
  transfer: ['transfer', 'pengirim', 'bank'],
  ewallet: ['gopay', 'ovo', 'dana', 'shopeepay', 'linkaja', 'ewallet', 'e-wallet'],
  kredit: ['kredit', 'cicil'],
};

async function getAllWallets(householdId) {
  const result = await pool.query(
    `SELECT id, name, type, sort_order, is_default
     FROM wallets WHERE household_id = $1 ORDER BY is_default DESC, sort_order ASC, name ASC`,
    [householdId]
  );
  return result.rows;
}

async function getWalletIdentifiers(householdId) {
  const result = await pool.query(
    `SELECT wallet_id, identifier_type, identifier_value
     FROM wallet_identifiers WHERE household_id = $1`,
    [householdId]
  );
  return result.rows;
}

/**
 * Resolve best wallet ID from suggested payment method, bank name, or account info.
 * Priority: personal identifier > wallet name match > keyword match > default wallet
 */
export async function resolveWalletId(householdId, {
  suggestedPayment = null,
  bankName = null,
  accountLast4 = null,
  ewalletName = null,
  walletNameFromAi = null,
} = {}) {
  const [wallets, identifiers] = await Promise.all([
    getAllWallets(householdId),
    getWalletIdentifiers(householdId),
  ]);

  if (wallets.length === 0) return null;

  // 1. Try wallet name from AI
  if (walletNameFromAi) {
    const norm = normalizeText(walletNameFromAi);
    const match = wallets.find((w) => normalizeText(w.name).includes(norm));
    if (match) return match.id;
  }

  // 2. Try account last4 from personal identifiers
  if (accountLast4) {
    const ident = identifiers.find((i) =>
      i.identifier_type === 'account_last4' && i.identifier_value === accountLast4
    );
    if (ident) {
      const w = wallets.find((w) => w.id === ident.wallet_id);
      if (w) return w.id;
    }
  }

  // 3. Try bank name from personal identifiers
  if (bankName) {
    const norm = normalizeText(bankName);
    const ident = identifiers.find((i) =>
      i.identifier_type === 'bank_name' && normalizeText(i.identifier_value).includes(norm)
    );
    if (ident) {
      const w = wallets.find((w) => w.id === ident.wallet_id);
      if (w) return w.id;
    }
  }

  // 4. Try ewallet name from personal identifiers
  if (ewalletName) {
    const norm = normalizeText(ewalletName);
    const ident = identifiers.find((i) =>
      i.identifier_type === 'ewallet_name' && normalizeText(i.identifier_value).includes(norm)
    );
    if (ident) {
      const w = wallets.find((w) => w.id === ident.wallet_id);
      if (w) return w.id;
    }
  }

  // 5. Try suggested payment keyword matching
  if (suggestedPayment) {
    const sp = normalizeText(suggestedPayment);
    const keywords = PAYMENT_KEYWORD_MAP[suggestedPayment] || [suggestedPayment];

    for (const kw of keywords) {
      const match = wallets.find((w) => normalizeText(w.name).includes(kw));
      if (match) return match.id;
    }
  }

  // 6. Fallback: wallet containing 'tunai' or 'utama' or default
  const tunai = wallets.find((w) => normalizeText(w.name).includes('tunai'));
  if (tunai) return tunai.id;

  const def = wallets.find((w) => w.is_default);
  if (def) return def.id;

  return wallets[0]?.id || null;
}

/**
 * Resolve both source and destination wallets for transfer detection.
 * If both wallets belong to the same household → transfer.
 * If destination is not a user wallet → expense (merchant).
 */
export async function resolveTransferWallets(householdId, {
  sourceBankName, sourceAccountLast4,
  destBankName, destAccountLast4,
  destEwalletName, destWalletNameFromAi,
} = {}) {
  const sourceWalletId = await resolveWalletId(householdId, {
    bankName: sourceBankName,
    accountLast4: sourceAccountLast4,
    walletNameFromAi: null,
  });

  const destWalletId = await resolveWalletId(householdId, {
    bankName: destBankName,
    accountLast4: destAccountLast4,
    ewalletName: destEwalletName,
    walletNameFromAi: destWalletNameFromAi,
  });

  // If both resolve to user wallets → it's a transfer
  const isInternalTransfer = Boolean(sourceWalletId && destWalletId);

  return {
    source_wallet_id: sourceWalletId,
    destination_wallet_id: isInternalTransfer ? destWalletId : null,
    is_internal_transfer: isInternalTransfer,
  };
}
