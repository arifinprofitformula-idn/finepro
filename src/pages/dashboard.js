// src/pages/dashboard.js
// Controller untuk layar dashboard: ambil transaksi bulan berjalan,
// hitung KPI, dan siapkan data untuk chart. Tidak menyentuh DOM langsung
// (itu tugas index.html + Alpine) — hanya mengembalikan data.

import { getMonthTransactions, summarize, groupExpenseByCategory } from "../lib/transactions.js";
import { monthKey, todayStr } from "../utils/format.js";
import { renderCategoryChart } from "../components/categoryChart.js";

export async function loadDashboardData(householdId) {
  const month = monthKey(todayStr());
  const transactions = await getMonthTransactions(householdId, month);
  const kpi = summarize(transactions);
  const byCategory = groupExpenseByCategory(transactions);

  // render chart langsung di sini agar pemanggil (main.js) tetap ringkas
  renderCategoryChart("categoryChart", byCategory);

  return { transactions, kpi };
}
