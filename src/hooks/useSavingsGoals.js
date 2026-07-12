import { useCallback, useEffect, useState } from "react";
import {
  addSavingsContribution,
  archiveSavingsGoal,
  createSavingsGoal,
  getSavingsGoals,
  updateSavingsGoal,
} from "../api/savingsGoals.js";

export function useSavingsGoals(householdId) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!householdId) return;
    setLoading(true);
    try {
      setGoals(await getSavingsGoals("active"));
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function addGoal(payload) {
    await createSavingsGoal(payload);
    await refresh();
  }

  async function editGoal(id, payload) {
    await updateSavingsGoal(id, payload);
    await refresh();
  }

  async function addContribution(goalId, payload) {
    await addSavingsContribution(goalId, payload);
    await refresh();
  }

  async function archiveGoal(id) {
    await archiveSavingsGoal(id);
    await refresh();
  }

  return { goals, loading, refresh, addGoal, editGoal, addContribution, archiveGoal };
}
