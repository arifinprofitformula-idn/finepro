import { useCallback, useEffect, useState } from "react";
import { getCurrentMetalPrices } from "../api/metalPrices.js";

export function useMetalPrices(enabled = true) {
  const [prices, setPrices] = useState({ enabled: false, gold: null, silver: null });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      setPrices(await getCurrentMetalPrices());
    } catch {
      setPrices({ enabled: false, gold: null, silver: null });
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { prices, loading, refresh };
}
