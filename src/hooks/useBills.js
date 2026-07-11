import { useState, useCallback, useEffect } from "react";
import { getBills, getUpcomingBills, createBill, updateBill, markBillPaid, deleteBill } from "../api/bills.js";

export function useBills(householdId) {
  const [bills, setBills] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!householdId) return;
    setLoading(true);
    try {
      const [all, soon] = await Promise.all([getBills(), getUpcomingBills()]);
      setBills(all);
      setUpcoming(soon);
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function addBill(payload) {
    await createBill(payload);
    await refresh();
  }

  async function editBill(id, payload) {
    await updateBill(id, payload);
    await refresh();
  }

  async function markPaid(id) {
    await markBillPaid(id);
    await refresh();
  }

  async function removeBill(id) {
    await deleteBill(id);
    await refresh();
  }

  return { bills, upcoming, loading, refresh, addBill, editBill, markPaid, removeBill };
}
