import { useCallback, useEffect, useState } from "react";
import { getTransactionHistory } from "../api/transactions.js";

const DEFAULT_FILTERS = { type: "", category: "", wallet_id: "", search: "", date_from: "", date_to: "" };
const PAGE_SIZE = 20;

export function useTransactionHistory(initialFilters = DEFAULT_FILTERS) {
  const [filters, setFilters] = useState(initialFilters);
  const [transactions, setTransactions] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const applyFilters = useCallback(async (nextFilters) => {
    setFilters(nextFilters);
    setLoading(true);
    try {
      const { transactions: rows, nextCursor, hasMore: more } = await getTransactionHistory(nextFilters, null, PAGE_SIZE);
      setTransactions(rows);
      setCursor(nextCursor);
      setHasMore(more);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    applyFilters(initialFilters);
  }, [applyFilters, initialFilters]);

  async function loadMore() {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const { transactions: rows, nextCursor, hasMore: more } = await getTransactionHistory(filters, cursor, PAGE_SIZE);
      setTransactions((prev) => [...prev, ...rows]);
      setCursor(nextCursor);
      setHasMore(more);
    } finally {
      setLoadingMore(false);
    }
  }

  async function refresh() {
    await applyFilters(filters);
  }

  return { filters, transactions, hasMore, loading, loadingMore, applyFilters, loadMore, refresh, defaultFilters: DEFAULT_FILTERS };
}
