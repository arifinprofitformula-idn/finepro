import { useState, useCallback, useEffect } from "react";
import { getArisanGroups, createArisanGroup, deleteArisanGroup } from "../api/arisan.js";

export function useArisan(householdId) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!householdId) return;
    setLoading(true);
    try {
      setGroups(await getArisanGroups());
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function addGroup(payload) {
    const group = await createArisanGroup(payload);
    setGroups((prev) => [group, ...prev]);
  }

  async function removeGroup(id) {
    await deleteArisanGroup(id);
    setGroups((prev) => prev.filter((g) => g.id !== id));
  }

  return { groups, loading, refresh, addGroup, removeGroup };
}
