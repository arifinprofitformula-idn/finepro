// src/pages/DashboardPage.jsx
// Murni presentasional — data (transactions/kpi/budgets/byCategory) dan
// modal tambah transaksi dikelola di App.jsx (app-shell), supaya FAB &
// tombol "Tambah" di BottomNav bisa dipicu dari halaman mana pun, sama
// seperti modal-backdrop global di versi Alpine lama.

import { useEffect, useMemo, useState } from "react";
import KpiCard from "../components/KpiCard.jsx";
import CategoryChart from "../components/CategoryChart.jsx";
import TransactionItem from "../components/TransactionItem.jsx";
import BudgetRow from "../components/BudgetRow.jsx";
import { setBudget } from "../api/budgets.js";
import { getContributions } from "../api/transactions.js";
import { getBills } from "../api/bills.js";
import { fmtRp, daysUntilMonthlyDay, daysUntilDate, formatNumberIdInput, parseNumberId, monthKey, todayStr } from "../utils/format.js";
import { ArrowRight, Bell, ChevronUp, Eye, EyeOff, HandHeart, PieChart, Sparkles, Users } from "lucide-react";

const DEFAULT_TX_SHOWN = 20;
const SHOW_CONTRIBUTIONS_KEY = "finepro-show-contributions";

export default function DashboardPage({ household, transactions, kpi, budgets, byCategory, categoriesExpense, onDataChanged }) {
  const [showAll, setShowAll] = useState(false);
  const [budgetInputs, setBudgetInputs] = useState({});
  const [savingCategory, setSavingCategory] = useState(null);
  const [showContributions, setShowContributions] = useState(false);
  const [contributions, setContributions] = useState([]);
  const [upcomingBills, setUpcomingBills] = useState([]);

  const isStudent = household.household_type === "student";
  const isFamily = household.household_type === "family";
  const subscriptionExpired = household.subscription_status === "expired";
  const daysUntilIncome = isStudent ? daysUntilMonthlyDay(household.monthly_income_day) : null;

  useEffect(() => {
    const saved = localStorage.getItem(SHOW_CONTRIBUTIONS_KEY) === "1";
    setShowContributions(saved);
    if (saved && isFamily) {
      getContributions(monthKey(todayStr())).then(setContributions).catch(() => {});
    }
    getBills()
      .then((bills) =>
        setUpcomingBills(bills.filter((b) => !b.paid_at && daysUntilDate(b.due_date) <= 3))
      )
      .catch(() => setUpcomingBills([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household.id]);

  async function handleToggleContributions() {
    const next = !showContributions;
    setShowContributions(next);
    localStorage.setItem(SHOW_CONTRIBUTIONS_KEY, next ? "1" : "0");
    if (next) {
      try {
        setContributions(await getContributions(monthKey(todayStr())));
      } catch {
        setContributions([]);
      }
    }
  }

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
    return budgetInputs[category] !== undefined ? budgetInputs[category] : formatNumberIdInput(budgets[category] || "");
  }

  async function handleSaveBudget(category) {
    const amount = parseNumberId(inputValueFor(category));
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
    <div className="max-w-lg mx-auto px-5 pb-28">
      {subscriptionExpired && (
        <div className="gloss-panel mb-4 rounded-3xl p-4 text-sm font-semibold text-coral">
          Langganan Anda telah berakhir. Data lama tetap bisa dilihat, tapi Anda perlu perpanjang di halaman{" "}
          <strong>Akun</strong> untuk menambah transaksi baru.
        </div>
      )}

      {isStudent && daysUntilIncome !== null && daysUntilIncome <= 3 && (
        <div className="gloss-panel mb-4 rounded-3xl p-4 text-sm font-semibold text-gold">
          {daysUntilIncome === 0
            ? "Uang bulanan biasanya cair hari ini. Yuk susun rencana pengeluaran."
            : `Uang bulanan biasanya cair ${daysUntilIncome} hari lagi. Yuk susun rencana pengeluaran.`}
        </div>
      )}

      {upcomingBills.length > 0 && (
        <div className="gloss-panel mb-4 rounded-3xl p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-coral">
            <Bell size={16} />
            Tagihan segera jatuh tempo
          </div>
          {upcomingBills.map((b) => {
            const d = daysUntilDate(b.due_date);
            return (
              <div key={b.id} className="flex items-center justify-between py-1 text-sm">
                <span className="text-navy">{b.name}</span>
                <span className="font-semibold text-coral">
                  {fmtRp(b.amount)} · {d < 0 ? `Telat ${-d} hari` : d === 0 ? "Hari ini" : `${d} hari lagi`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mb-4 grid gap-2.5">
        <KpiCard label="Pemasukan" value={fmtRp(kpi.income)} tone="income" />
        <KpiCard label="Pengeluaran" value={fmtRp(kpi.expense)} tone="expense" />
        <KpiCard label="Saldo" value={fmtRp(kpi.income - kpi.expense)} tone="balance" />
      </div>

      {isFamily && (
        <div className="gloss-panel mb-4 flex items-center justify-between rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-light text-gold">
              <HandHeart size={16} />
            </div>
            <div className="text-sm font-semibold text-navy">Ibadah & Sedekah bulan ini</div>
          </div>
          <div className="text-sm font-bold text-navy">{fmtRp(byCategory["Ibadah & Sedekah"] || 0)}</div>
        </div>
      )}

      <div className="gloss-panel mb-4 rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-light text-violet">
              <PieChart size={16} />
            </div>
            <h2 className="text-base font-semibold text-navy">Pengeluaran per Kategori</h2>
          </div>
        </div>
        <CategoryChart byCategory={byCategory} />
      </div>

      {budgetProgress.length > 0 && (
        <div className="gloss-panel mb-4 rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-navy">Budget vs Realisasi</h2>
            <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-400" title="Ciutkan">
              <ChevronUp size={22} strokeWidth={2.5} />
            </button>
          </div>
          {budgetProgress.map((b) => (
            <BudgetRow
              key={b.category}
              category={b.category}
              budget={b.budget}
              spent={b.spent}
              pct={b.pct}
              inputValue={inputValueFor(b.category)}
              onInputChange={(value) =>
                setBudgetInputs((prev) => ({ ...prev, [b.category]: formatNumberIdInput(value) }))
              }
              onSave={() => handleSaveBudget(b.category)}
              saving={savingCategory === b.category}
            />
          ))}
        </div>
      )}

      {isFamily && (
        <div className="gloss-panel mb-4 rounded-2xl p-4">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-mint-light text-mint">
                <Users size={16} />
              </div>
              <h2 className="text-base font-semibold text-navy">Kontribusi Anggota</h2>
            </div>
            <button
              type="button"
              onClick={handleToggleContributions}
              className="flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-violet"
            >
              {showContributions ? <EyeOff size={15} /> : <Eye size={15} />}
              {showContributions ? "Sembunyikan" : "Tampilkan"}
            </button>
          </div>
          {showContributions && (
            contributions.length === 0 ? (
              <div className="py-2 text-xs font-medium text-neutral-500">Belum ada data bulan ini.</div>
            ) : (
              contributions.map((c) => (
                <div
                  key={c.userId}
                  className="flex items-center justify-between border-b border-neutral-border/60 py-2 last:border-0"
                >
                  <div className="truncate text-sm font-medium text-navy">{c.name}</div>
                  <div className="text-sm font-semibold text-coral">{fmtRp(c.expense)}</div>
                </div>
              ))
            )
          )}
        </div>
      )}

      <div className="gloss-panel rounded-2xl p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-navy">Transaksi Terbaru</h2>
          {!showAll && transactions.length > DEFAULT_TX_SHOWN && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="flex min-h-[40px] items-center gap-1 text-sm font-medium text-violet"
            >
              Lihat semua
              <ArrowRight size={18} />
            </button>
          )}
        </div>
        {visibleTransactions.map((tx) => (
          <TransactionItem key={tx.id} tx={tx} />
        ))}
        {transactions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center text-sm font-semibold text-neutral-500">
            <Sparkles size={28} className="mb-2 text-violet" />
            Belum ada transaksi bulan ini. Tekan tombol + untuk menambah.
          </div>
        )}
      </div>
    </div>
  );
}
