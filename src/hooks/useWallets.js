// src/hooks/useWallets.js
// Fetch & mutate dompet milik household yang login, konsisten dengan pola
// hook lain (useHousehold.js, useDashboard.js): state + refresh + actions.

import { useState, useCallback, useEffect } from "react";
import { getWallets, createWallet as apiCreateWallet, transferBetweenWallets as apiTransfer } from "../api/wallets.js";

export function useWallets(householdId) {
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!householdId) {
      setWallets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setWallets(await getWallets());
    } catch {
      setWallets([]);
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createWallet = useCallback(async (name) => {
    await apiCreateWallet(name);
    await refresh();
  }, [refresh]);

  const transfer = useCallback(async (payload) => {
    const result = await apiTransfer(payload);
    await refresh();
    return result;
  }, [refresh]);

  return { wallets, loading, refresh, createWallet, transfer };
}
