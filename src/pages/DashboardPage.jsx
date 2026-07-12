// src/pages/DashboardPage.jsx
// Murni presentasional — data (transactions/kpi/budgets/byCategory) dan
// modal tambah transaksi dikelola di App.jsx (app-shell), supaya FAB &
// tombol "Tambah" di BottomNav bisa dipicu dari halaman mana pun, sama
// seperti modal-backdrop global di versi Alpine lama.

import { useEffect, useMemo, useState } from "react";
import KpiCard from "../components/KpiCard.jsx";
import CategoryChart from "../components/CategoryChart.jsx";
import DailyChart from "../components/DailyChart.jsx";
import DailySummaryCard from "../components/DailySummaryCard.jsx";
import MonthlyChart from "../components/MonthlyChart.jsx";
import TransactionItem from "../components/TransactionItem.jsx";
import BudgetRow from "../components/BudgetRow.jsx";
import ZakatWidget from "../components/ZakatWidget.jsx";
import BillsSection from "../components/BillsSection.jsx";
import InsightButton from "../components/InsightButton.jsx";
import InsightCard from "../components/InsightCard.jsx";
import { useAiInsight } from "../hooks/useAiInsight.js";
import { setBudget } from "../api/budgets.js";
import { getContributions, getDailySummaryRows, groupByDay, getMonthlySummary } from "../api/transactions.js";
import { fmtRp, daysUntilMonthlyDay, formatNumberIdInput, parseNumberId, currentMonthKey, monthKeyToParts, monthLabel, shiftMonthKey } from "../utils/format.js";
import { ArrowRight, BarChart3, CalendarDays, ChevronLeft, ChevronRight, ChevronUp, Eye, EyeOff, PieChart, ReceiptText, Sparkles, Target, Users } from "lucide-react";

const DEFAULT_TX_SHOWN = 20;
const SHOW_CONTRIBUTIONS_KEY = "finepro-show-contributions";

const CHART_MODES = {
  daily: { title: "Analisis Harian", icon: BarChart3 },
  category: { title: "Pengeluaran per Kategori", icon: PieChart },
  monthly: { title: "Analisis Bulanan", icon: CalendarDays }
};

function PeriodSelector({ monthKey, onChange }) {
  const isCurrentMonth = monthKey === currentMonthKey();

  return (
    <div className="gloss-panel mb-4 rounded-2xl p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold text-neutral-500">
        <CalendarDays size={14} />
        Periode catatan
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(shiftMonthKey(monthKey, -1))}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/70 text-navy transition active:scale-[0.98]"
          title="Bulan sebelumnya"
        >
          <ChevronLeft size={18} />
        </button>
        <label className="sr-only" htmlFor="dashboard-period">Pilih bulan dan tahun</label>
        <input
          id="dashboard-period"
          type="month"
          value={monthKey}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="min-h-[40px] min-w-0 flex-1 rounded-full border border-white/80 bg-white/70 px-3 text-center text-sm font-bold text-navy outline-none"
        />
        <button
          type="button"
          onClick={() => onChange(shiftMonthKey(monthKey, 1))}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/70 text-navy transition active:scale-[0.98]"
          title="Bulan berikutnya"
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="truncate text-xs font-semibold text-neutral-500">{monthLabel(monthKey)}</div>
        {!isCurrentMonth && (
          <button
            type="button"
            onClick={() => onChange(currentMonthKey())}
            className="flex-shrink-0 rounded-full bg-mint-light px-3 py-1.5 text-xs font-bold text-mint"
          >
            Bulan Ini
          </button>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage({ household, transactions, kpi, budgets, byCategory, categoriesExpense, onDataChanged, selectedMonthKey, onPeriodChange }) {
  const [showAll, setShowAll] = useState(false);
  const [budgetInputs, setBudgetInputs] = useState({});
  const [savingCategory, setSavingCategory] = useState(null);
  const [showContributions, setShowContributions] = useState(false);
  const [contributions, setContributions] = useState([]);
  const [chartMode, setChartMode] = useState("daily");
  const [monthlyData, setMonthlyData] = useState(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const insight = useAiInsight();

  const selectedYear = monthKeyToParts(selectedMonthKey).year;
  const dailyData = useMemo(() => groupByDay(transactions, selectedMonthKey), [transactions, selectedMonthKey]);
  const dailySummaryRows = useMemo(() => getDailySummaryRows(transactions, selectedMonthKey), [transactions, selectedMonthKey]);

  useEffect(() => {
    if (chartMode !== "monthly" || monthlyData?.year === selectedYear) return;
    setMonthlyLoading(true);
    getMonthlySummary(selectedYear)
      .then((months) => setMonthlyData({ year: selectedYear, months }))
      .catch(() => setMonthlyData({ year: selectedYear, months: [] }))
      .finally(() => setMonthlyLoading(false));
  }, [chartMode, monthlyData, selectedYear]);

  const isStudent = household.household_type === "student";
  const isFamily = household.household_type === "family";
  const subscriptionExpired = household.subscription_status === "expired";
  const daysUntilIncome = isStudent ? daysUntilMonthlyDay(household.monthly_income_day) : null;

  useEffect(() => {
    const saved = localStorage.getItem(SHOW_CONTRIBUTIONS_KEY) === "1";
    setShowContributions(saved);
    if (saved && isFamily) {
      getContributions(selectedMonthKey).then(setContributions).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household.id, selectedMonthKey]);

  async function handleToggleContributions() {
    const next = !showContributions;
    setShowContributions(next);
    localStorage.setItem(SHOW_CONTRIBUTIONS_KEY, next ? "1" : "0");
    if (next) {
      try {
        setContributions(await getContributions(selectedMonthKey));
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
  const balance = kpi.income - kpi.expense;
  const balanceStatus =
    balance < 0
      ? "danger"
      : kpi.income > 0 && balance > 0 && balance <= kpi.income * 0.2
      ? "warning"
      : "safe";

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
      <PeriodSelector monthKey={selectedMonthKey} onChange={onPeriodChange} />

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

      <div className="mb-4 grid gap-2.5">
        <KpiCard label="Pemasukan" value={fmtRp(kpi.income)} tone="income" />
        <KpiCard label="Pengeluaran" value={fmtRp(kpi.expense)} tone="expense" />
        <KpiCard label="Saldo" value={fmtRp(balance)} tone="balance" status={balanceStatus} />
      </div>

      <DailySummaryCard rows={dailySummaryRows} monthKey={selectedMonthKey} />

      <InsightButton onClick={insight.generate} loading={insight.loading} />
      {insight.error && !insight.rateLimited && (
        <div className="gloss-panel mb-4 rounded-2xl p-3 text-sm font-medium text-coral">{insight.error}</div>
      )}
      <InsightCard
        narrative={insight.narrative}
        rateLimitMessage={insight.rateLimited ? insight.error : ""}
      />

      <ZakatWidget householdId={household.id} totalExpense={kpi.expense} monthKey={selectedMonthKey} />

      <BillsSection householdId={household.id} />

      <div className="gloss-panel mb-4 rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-light text-violet">
              {(() => {
                const Icon = CHART_MODES[chartMode].icon;
                return <Icon size={16} />;
              })()}
            </div>
            <h2 className="text-base font-semibold text-navy">{CHART_MODES[chartMode].title}</h2>
          </div>
        </div>
        <div className="mb-3 flex gap-2 rounded-full bg-neutral-100 p-1">
          {Object.entries(CHART_MODES).map(([key, { title }]) => (
            <button
              key={key}
              type="button"
              onClick={() => setChartMode(key)}
              className={`flex-1 rounded-full px-2 py-1.5 text-xs font-semibold transition ${
                chartMode === key ? "bg-white text-violet shadow-sm" : "text-neutral-500"
              }`}
            >
              {key === "daily" ? "Harian" : key === "category" ? "Kategori" : "Bulanan"}
            </button>
          ))}
        </div>
        {chartMode === "daily" && <DailyChart data={dailyData} />}
        {chartMode === "category" && <CategoryChart byCategory={byCategory} />}
        {chartMode === "monthly" && <MonthlyChart data={monthlyData?.months || []} loading={monthlyLoading} />}
      </div>

      {budgetProgress.length > 0 && (
        <div className="gloss-panel mb-4 rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gold-light text-gold">
                <Target size={16} />
              </div>
              <h2 className="truncate text-base font-semibold text-navy">Budget vs Realisasi</h2>
            </div>
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
              <div className="py-2 text-xs font-medium text-neutral-500">Belum ada data pada periode ini.</div>
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
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-light text-violet">
              <ReceiptText size={16} />
            </div>
            <h2 className="truncate text-base font-semibold text-navy">Transaksi Terbaru</h2>
          </div>
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
            Belum ada transaksi pada periode ini. Tekan tombol + untuk menambah.
          </div>
        )}
      </div>
    </div>
  );
}
