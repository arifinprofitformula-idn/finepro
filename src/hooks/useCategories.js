import { useState, useEffect, useCallback } from "react";
import { getCategories, createCategory as apiCreateCategory, renameCategory as apiRenameCategory, deleteCategory as apiDeleteCategory } from "../api/categories.js";

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

  const createCategory = useCallback(async (type, name) => {
    await apiCreateCategory(type, name);
    await refresh();
  }, [refresh]);

  const renameCategory = useCallback(async (id, name) => {
    await apiRenameCategory(id, name);
    await refresh();
  }, [refresh]);

  const deleteCategory = useCallback(async (id) => {
    await apiDeleteCategory(id);
    await refresh();
  }, [refresh]);

  return { categoriesExpense, categoriesIncome, loading, refresh, createCategory, renameCategory, deleteCategory };
}
