// src/pages/DashboardPage.jsx
// Murni presentasional — data (transactions/kpi/budgets/byCategory) dan
// modal tambah transaksi dikelola di App.jsx (app-shell), supaya FAB &
// tombol "Tambah" di BottomNav bisa dipicu dari halaman mana pun, sama
// seperti modal-backdrop global di versi Alpine lama.

import { useMemo, useState } from "react";
import KpiCard from "../components/KpiCard.jsx";
import CategoryChart from "../components/CategoryChart.jsx";
import TransactionItem from "../components/TransactionItem.jsx";
import BudgetRow from "../components/BudgetRow.jsx";
import { setBudget } from "../api/budgets.js";
import { fmtRp, daysUntilMonthlyDay } from "../utils/format.js";

const DEFAULT_TX_SHOWN = 20;

export default function DashboardPage({ household, transactions, kpi, budgets, byCategory, categoriesExpense, onDataChanged }) {
  const [showAll, setShowAll] = useState(false);
  const [budgetInputs, setBudgetInputs] = useState({});
  const [savingCategory, setSavingCategory] = useState(null);

  const isStudent = household.household_type === "student";
  const subscriptionExpired = household.subscription_status === "expired";
  const daysUntilIncome = isStudent ? daysUntilMonthlyDay(household.monthly_income_day) : null;

  const budgetProgress = useMemo(() => {
    return categoriesExpense.map((c) => {
      const budget = budgets[c.name] || 0;
      const spent = byCategory[c.name] || 0;
      const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
      return { category: c.name, budget, spent, pct };
    });
  }, [categoriesExpense, budgets, byCategory]);

  const visibleTransactions = showAll ? transactions : transactions.slice(0, DEFAULT_TX_SHOWN);

  function inputValueFor(category) {
    return budgetInputs[category] !== undefined ? budgetInputs[category] : budgets[category] || "";
  }

  async function handleSaveBudget(category) {
    const amount = parseFloat(inputValueFor(category)) || 0;
    setSavingCategory(category);
    try {
      await setBudget(household.id, category, amount);
      await onDataChanged();
    } catch (err) {
      alert("Gagal menyimpan budget: " + err.message);
    } finally {
      setSavingCategory(null);
    }
  }

  return (
    <div className="px-4 pt-1 pb-24 max-w-lg mx-auto">
      {subscriptionExpired && (
        <div className="bg-danger/10 border border-danger rounded-xl p-3 mb-3 text-xs text-neutral-900">
          Langganan Anda telah berakhir. Data lama tetap bisa dilihat, tapi Anda perlu perpanjang di halaman{" "}
          <strong>Akun</strong> untuk menambah transaksi baru.
        </div>
      )}

      {isStudent && daysUntilIncome !== null && daysUntilIncome <= 3 && (
        <div className="bg-gold/10 border border-gold rounded-xl p-3 mb-3 text-xs text-neutral-900">
          {daysUntilIncome === 0
            ? "Uang bulanan biasanya cair hari ini. Yuk susun rencana pengeluaran."
            : `Uang bulanan biasanya cair ${daysUntilIncome} hari lagi. Yuk susun rencana pengeluaran.`}
        </div>
      )}

      <div className="flex gap-2.5 overflow-x-auto pb-1 mb-3 -mx-1 px-1">
        <KpiCard label="Pemasukan" value={fmtRp(kpi.income)} tone="income" />
        <KpiCard label="Pengeluaran" value={fmtRp(kpi.expense)} tone="expense" />
        <KpiCard label="Saldo" value={fmtRp(kpi.income - kpi.expense)} tone="balance" />
      </div>

      <div className="bg-white border border-neutral-border rounded-xl p-3 mb-3">
        <h2 className="text-sm font-semibold text-neutral-900 mb-2">Pengeluaran per Kategori</h2>
        <CategoryChart byCategory={byCategory} />
      </div>

      {budgetProgress.length > 0 && (
        <div className="bg-white border border-neutral-border rounded-xl p-3 mb-3">
          <h2 className="text-sm font-semibold text-neutral-900 mb-1">Budget vs Realisasi</h2>
          {budgetProgress.map((b) => (
            <BudgetRow
              key={b.category}
              category={b.category}
              budget={b.budget}
              spent={b.spent}
              pct={b.pct}
              inputValue={inputValueFor(b.category)}
              onInputChange={(e) => setBudgetInputs((prev) => ({ ...prev, [b.category]: e.target.value }))}
              onSave={() => handleSaveBudget(b.category)}
              saving={savingCategory === b.category}
            />
          ))}
        </div>
      )}

      <div className="bg-white border border-neutral-border rounded-xl p-3">
        <h2 className="text-sm font-semibold text-neutral-900 mb-1">Transaksi Terbaru</h2>
        {visibleTransactions.map((tx) => (
          <TransactionItem key={tx.id} tx={tx} />
        ))}
        {transactions.length === 0 && (
          <div className="text-xs text-neutral-500 text-center py-4">
            Belum ada transaksi bulan ini. Tekan tombol + untuk menambah.
          </div>
        )}
        {!showAll && transactions.length > DEFAULT_TX_SHOWN && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="w-full text-center text-xs font-semibold text-navy py-2 min-h-[36px]"
          >
            Lihat semua ({transactions.length})
          </button>
        )}
      </div>
    </div>
  );
}
