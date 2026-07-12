import { useRef, useState } from "react";
import { useSavingsGoals } from "../hooks/useSavingsGoals.js";
import { useMetalPrices } from "../hooks/useMetalPrices.js";
import { fmtRp, formatNumberIdInput, parseNumberId, todayStr } from "../utils/format.js";
import { CalendarDays, Coins, Gem, PiggyBank, Plus, Save, Target, X } from "lucide-react";

const GOAL_OPTIONS = [
  { value: "money", label: "Rupiah", icon: PiggyBank, tone: "bg-mint-light text-mint" },
  { value: "gold", label: "Emas", icon: Gem, tone: "bg-gold-light text-gold" },
  { value: "silver", label: "Perak", icon: Coins, tone: "bg-violet-light text-violet" },
];

const EMPTY_GOAL = {
  name: "",
  goal_type: "money",
  target_amount: "",
  target_weight: "",
  target_date: "",
};

const EMPTY_CONTRIBUTION = {
  date: todayStr(),
  amount_paid: "",
  weight: "",
  note: "",
};

function goalMeta(type) {
  return GOAL_OPTIONS.find((item) => item.value === type) || GOAL_OPTIONS[0];
}

function formatGram(value) {
  const number = Number(value || 0);
  return `${number.toLocaleString("id-ID", { maximumFractionDigits: 3 })} gram`;
}

function goalProgressLabel(goal) {
  if (goal.goal_type === "money") {
    return `${fmtRp(Number(goal.total_amount_paid || 0))} dari ${fmtRp(Number(goal.target_amount || 0))}`;
  }
  return `${formatGram(goal.total_weight)} dari ${formatGram(goal.target_weight)}`;
}

function formatDisplayDate(value, emptyLabel) {
  if (!value) return emptyLabel;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatShortDate(value) {
  if (!value) return null;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatPriceUpdateDate(goldFetchedAt, silverFetchedAt) {
  const latest = [goldFetchedAt, silverFetchedAt].filter(Boolean).sort().pop();
  if (!latest) return "Update harga terakhir belum tersedia";
  return `Update harga terakhir: ${new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(latest))}`;
}

function DateField({ label, value, onChange, emptyLabel = "Pilih tanggal" }) {
  const inputRef = useRef(null);

  function openPicker() {
    const input = inputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
        return;
      } catch {
        // fall through to focus below
      }
    }
    input.focus();
  }

  return (
    <label
      onClick={openPicker}
      className="group relative flex min-h-[48px] cursor-pointer items-center gap-3 rounded-2xl border border-neutral-border bg-white px-3 shadow-[inset_0_1px_2px_rgba(15,31,61,0.04)] transition focus-within:border-violet focus-within:shadow-[0_0_0_4px_rgba(111,85,242,0.10),inset_0_1px_2px_rgba(15,31,61,0.04)]"
    >
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-violet-light text-violet">
        <CalendarDays size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold uppercase tracking-wide text-neutral-400">{label}</span>
        <span className={`block truncate text-sm font-bold ${value ? "text-navy" : "text-neutral-500"}`}>
          {formatDisplayDate(value, emptyLabel)}
        </span>
      </span>
      <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-bold text-violet">Ubah</span>
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  );
}

export default function SavingsGoalsSection({ householdId }) {
  const { goals, loading, addGoal, addContribution, archiveGoal } = useSavingsGoals(householdId);
  const { prices } = useMetalPrices(Boolean(householdId));
  const [showCreate, setShowCreate] = useState(false);
  const [goalForm, setGoalForm] = useState(EMPTY_GOAL);
  const [openContributionId, setOpenContributionId] = useState(null);
  const [contributionForm, setContributionForm] = useState(EMPTY_CONTRIBUTION);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateGoalForm(key, value) {
    setGoalForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateContributionForm(key, value) {
    setContributionForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreateGoal(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await addGoal({
        name: goalForm.name,
        goal_type: goalForm.goal_type,
        target_amount: goalForm.goal_type === "money" ? parseNumberId(goalForm.target_amount) : null,
        target_weight: goalForm.goal_type === "money" ? null : parseNumberId(goalForm.target_weight),
        target_date: goalForm.target_date || null,
      });
      setGoalForm(EMPTY_GOAL);
      setShowCreate(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddContribution(e, goal) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await addContribution(goal.id, {
        date: contributionForm.date,
        amount_paid: parseNumberId(contributionForm.amount_paid),
        weight: goal.goal_type === "money" ? 0 : parseNumberId(contributionForm.weight),
        note: contributionForm.note,
      });
      setContributionForm(EMPTY_CONTRIBUTION);
      setOpenContributionId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(goal) {
    if (!confirm(`Arsipkan target "${goal.name}"?`)) return;
    setError("");
    try {
      await archiveGoal(goal.id);
    } catch (err) {
      setError(err.message);
    }
  }

  function openContribution(goalId) {
    setOpenContributionId((current) => (current === goalId ? null : goalId));
    setContributionForm(EMPTY_CONTRIBUTION);
    setError("");
  }

  if (loading) return null;

  const metalPricesEnabled = Boolean(prices?.enabled && prices.gold && prices.silver);
  // Estimasi nilai tabungan memakai harga buyback (harga jika dijual balik),
  // dengan fallback ke harga jual biasa jika buyback belum tersedia di cache.
  const valuationPriceByType = {
    gold: prices?.gold_buyback || prices?.gold,
    silver: prices?.silver_buyback || prices?.silver,
  };

  return (
    <div className="gloss-panel mb-4 rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-mint-light text-mint">
            <Target size={16} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-navy">Target Tabungan & Aset</h2>
            <p className="truncate text-xs font-medium text-neutral-500">Rupiah, Emas, dan Perak</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowCreate((value) => !value);
            setError("");
          }}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-violet-light text-violet transition active:scale-[0.98]"
          aria-label="Tambah target tabungan"
        >
          {showCreate ? <X size={18} /> : <Plus size={18} />}
        </button>
      </div>

      {error && <div className="mb-3 rounded-2xl bg-coral-light/80 p-3 text-xs font-semibold text-coral">{error}</div>}

      {metalPricesEnabled && (
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <div className="relative overflow-hidden rounded-2xl bg-gold-light/70 px-3 py-2">
            <img
              src="/images/goldgram-logo.png"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -right-1 -top-1 h-10 w-auto max-w-[110px] object-contain opacity-30"
              loading="lazy"
            />
            <div className="relative z-10 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gold">
              <Gem size={12} />
              Emas
            </div>
            <div className="relative z-10 mt-0.5 text-sm font-extrabold text-navy">{fmtRp(Number(prices.gold.price_per_gram || 0))} / gram</div>
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-violet-light/60 px-3 py-2">
            <img
              src="/images/silvergram-logo.png"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -right-1 -top-1 h-10 w-auto max-w-[110px] object-contain opacity-30"
              loading="lazy"
            />
            <div className="relative z-10 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-violet">
              <Coins size={12} />
              Perak
            </div>
            <div className="relative z-10 mt-0.5 text-sm font-extrabold text-navy">{fmtRp(Number(prices.silver.price_per_gram || 0))} / gram</div>
          </div>
        </div>
      )}
      {metalPricesEnabled && (
        <div className="mb-3 text-center text-[11px] font-semibold text-neutral-500">
          {formatPriceUpdateDate(prices.gold.fetched_at, prices.silver.fetched_at)}
        </div>
      )}

      {showCreate && (
        <form onSubmit={handleCreateGoal} className="mb-3 grid gap-2 rounded-2xl border border-neutral-border/70 bg-white/65 p-3">
          <input
            value={goalForm.name}
            onChange={(e) => updateGoalForm("name", e.target.value)}
            placeholder="Nama target, mis. Dana darurat"
            className="min-h-[42px] rounded-xl border border-neutral-border bg-white px-3 text-sm font-semibold text-navy outline-none focus:border-violet"
          />
          <div className="grid grid-cols-3 gap-2">
            {GOAL_OPTIONS.map((option) => {
              const Icon = option.icon;
              const active = goalForm.goal_type === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateGoalForm("goal_type", option.value)}
                  className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition ${
                    active ? option.tone : "bg-white text-neutral-500"
                  }`}
                >
                  <Icon size={14} />
                  {option.label}
                </button>
              );
            })}
          </div>
          {goalForm.goal_type === "money" ? (
            <input
              inputMode="numeric"
              value={goalForm.target_amount}
              onChange={(e) => updateGoalForm("target_amount", formatNumberIdInput(e.target.value))}
              placeholder="Target nominal"
              className="min-h-[42px] rounded-xl border border-neutral-border bg-white px-3 text-sm font-semibold text-navy outline-none focus:border-violet"
            />
          ) : (
            <input
              inputMode="decimal"
              value={goalForm.target_weight}
              onChange={(e) => updateGoalForm("target_weight", formatNumberIdInput(e.target.value))}
              placeholder="Target berat dalam gram"
              className="min-h-[42px] rounded-xl border border-neutral-border bg-white px-3 text-sm font-semibold text-navy outline-none focus:border-violet"
            />
          )}
          <DateField
            label="Target selesai"
            value={goalForm.target_date}
            onChange={(value) => updateGoalForm("target_date", value)}
            emptyLabel="Opsional"
          />
          <button
            type="submit"
            disabled={saving}
            className="flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-navy px-4 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? "Menyimpan..." : "Simpan Target"}
          </button>
        </form>
      )}

      {goals.length === 0 ? (
        <div className="rounded-2xl bg-white/55 px-3 py-4 text-center text-sm font-medium text-neutral-500">
          Belum ada target. Mulai dari dana darurat, tabungan emas, atau rencana pembelian penting.
        </div>
      ) : (
        <div className="grid gap-2.5">
          {goals.map((goal) => {
            const meta = goalMeta(goal.goal_type);
            const Icon = meta.icon;
            const progress = Number(goal.progress_percent || 0);
            const contributionOpen = openContributionId === goal.id;
            const metalPrice = valuationPriceByType[goal.goal_type];
            const assetValue = metalPricesEnabled && metalPrice ? Number(goal.total_weight || 0) * Number(metalPrice.price_per_gram || 0) : 0;

            return (
              <div key={goal.id} className="rounded-2xl border border-neutral-border/70 bg-white/65 p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-navy">{goal.name}</div>
                      <div className="text-xs font-semibold text-neutral-500">{goalProgressLabel(goal)}</div>
                      {goal.goal_type !== "money" && Number(goal.total_amount_paid || 0) > 0 && (
                        <div className="text-[11px] font-semibold text-neutral-400">
                          Nilai dibayar {fmtRp(Number(goal.total_amount_paid || 0))}
                        </div>
                      )}
                      {goal.goal_type !== "money" && assetValue > 0 && (
                        <>
                          <div className="text-[11px] font-bold text-mint">Estimasi nilai {fmtRp(assetValue)}</div>
                          {formatShortDate(metalPrice?.fetched_at) && (
                            <div className="text-[10px] font-semibold text-neutral-400">
                              Harga buyback {goal.goal_type === "gold" ? "emas" : "perak"} terupdate {formatShortDate(metalPrice.fetched_at)}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-sm font-extrabold text-violet">{progress}%</div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-mint to-violet transition-all" style={{ width: `${progress}%` }} />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => openContribution(goal.id)}
                    className="flex min-h-[36px] items-center gap-1.5 rounded-full bg-mint-light px-3 text-xs font-bold text-mint"
                  >
                    <Plus size={14} />
                    Tambah Setoran
                  </button>
                  <button
                    type="button"
                    onClick={() => handleArchive(goal)}
                    className="min-h-[36px] rounded-full px-3 text-xs font-semibold text-neutral-400"
                  >
                    Arsipkan
                  </button>
                </div>

                {contributionOpen && (
                  <form onSubmit={(e) => handleAddContribution(e, goal)} className="mt-3 grid gap-2 border-t border-neutral-border/70 pt-3">
                    <DateField
                      label="Tanggal setoran"
                      value={contributionForm.date}
                      onChange={(value) => updateContributionForm("date", value)}
                    />
                    {goal.goal_type !== "money" && (
                      <input
                        inputMode="decimal"
                        value={contributionForm.weight}
                        onChange={(e) => updateContributionForm("weight", formatNumberIdInput(e.target.value))}
                        placeholder="Berat yang dimiliki, gram"
                        className="min-h-[40px] rounded-xl border border-neutral-border bg-white px-3 text-sm font-semibold text-navy outline-none focus:border-violet"
                      />
                    )}
                    <input
                      inputMode="numeric"
                      value={contributionForm.amount_paid}
                      onChange={(e) => updateContributionForm("amount_paid", formatNumberIdInput(e.target.value))}
                      placeholder={goal.goal_type === "money" ? "Nominal setoran" : "Nilai pembelian, opsional"}
                      className="min-h-[40px] rounded-xl border border-neutral-border bg-white px-3 text-sm font-semibold text-navy outline-none focus:border-violet"
                    />
                    <input
                      value={contributionForm.note}
                      onChange={(e) => updateContributionForm("note", e.target.value)}
                      placeholder="Catatan singkat, opsional"
                      className="min-h-[40px] rounded-xl border border-neutral-border bg-white px-3 text-sm font-semibold text-navy outline-none focus:border-violet"
                    />
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex min-h-[40px] items-center justify-center gap-2 rounded-xl bg-violet px-4 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-60"
                    >
                      <Save size={16} />
                      {saving ? "Menyimpan..." : "Catat Setoran"}
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
