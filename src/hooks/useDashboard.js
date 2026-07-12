import { useState, useCallback, useEffect } from "react";
import { getMonthTransactions, summarize, groupExpenseByCategory } from "../api/transactions.js";
import { getBudgets } from "../api/budgets.js";
import { currentMonthKey, shiftMonthKey } from "../utils/format.js";

export function useDashboard(householdId, selectedMonthKey = currentMonthKey()) {
  const [transactions, setTransactions] = useState([]);
  const [kpi, setKpi] = useState({ income: 0, expense: 0 });
  const [previousKpi, setPreviousKpi] = useState({ income: 0, expense: 0 });
  const [budgets, setBudgets] = useState({});
  const [byCategory, setByCategory] = useState({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!householdId) return;
    setLoading(true);
    try {
      const previousMonthKey = shiftMonthKey(selectedMonthKey, -1);
      const [tx, previousTx, bud] = await Promise.all([
        getMonthTransactions(householdId, selectedMonthKey),
        getMonthTransactions(householdId, previousMonthKey),
        getBudgets(householdId)
      ]);
      setTransactions(tx);
      setKpi(summarize(tx));
      setPreviousKpi(summarize(previousTx));
      setByCategory(groupExpenseByCategory(tx));
      setBudgets(bud);
    } finally {
      setLoading(false);
    }
  }, [householdId, selectedMonthKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { transactions, kpi, previousKpi, budgets, byCategory, loading, refresh };
}
