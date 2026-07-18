// src/hooks/useHousehold.js
// Fetch & cache household milik user yang login. household di sini juga
// membawa plan/subscription_status/current_period_end (lihat api/routes/households.js)
// jadi tidak perlu hook/panggilan terpisah untuk data langganan.

import { useState, useCallback, useEffect } from "react";
import { getMyHousehold, createHousehold as apiCreateHousehold } from "../api/households.js";

export function useHousehold(user) {
  const [household, setHousehold] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setHousehold(null);
      setLoading(false);
      return null;
    }
    setLoading(true);
    try {
      const h = await getMyHousehold(user.id);
      setHousehold(h);
      return h;
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createHousehold = useCallback(async (type) => {
    await apiCreateHousehold(user.id, type);
    return refresh();
  }, [user, refresh]);

  return { household, loading, refresh, createHousehold, setHousehold };
}
