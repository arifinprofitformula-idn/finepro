import { useState, useEffect, useCallback } from "react";
import { getCategories } from "../api/categories.js";

export function useCategories(householdId) {
  const [categoriesExpense, setCategoriesExpense] = useState([]);
  const [categoriesIncome, setCategoriesIncome] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!householdId) return;
    setLoading(true);
    try {
      const [exp, inc] = await Promise.all([
        getCategories(householdId, "expense"),
        getCategories(householdId, "income")
      ]);
      setCategoriesExpense(exp);
      setCategoriesIncome(inc);
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { categoriesExpense, categoriesIncome, loading, refresh };
}
