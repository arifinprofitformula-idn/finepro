import { fmtRp } from "../utils/format.js";
import { PiggyBank, Save } from "lucide-react";

const RING_COLOR = { ok: "#18c594", warn: "#6f55f2", over: "#ff4b4b" };

function toneFor(pct) {
  if (pct < 80) return { key: "ok", color: RING_COLOR.ok, text: "text-mint", bg: "bg-mint-light", border: "border-mint" };
  if (pct <= 100) return { key: "warn", color: RING_COLOR.warn, text: "text-violet", bg: "bg-violet-light", border: "border-violet" };
  return { key: "over", color: RING_COLOR.over, text: "text-coral", bg: "bg-coral-light", border: "border-coral" };
}

export default function BudgetRow({ category, budget, spent, pct, inputValue, onInputChange, onSave, saving }) {
  const tone = toneFor(pct);
  const clamped = Math.min(pct, 100);

  return (
    <div className="grid gap-3 border-b border-neutral-border/60 py-3.5 last:border-0">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="relative h-14 w-14 flex-shrink-0 rounded-full shadow-soft"
          style={{ background: `conic-gradient(${tone.color} ${clamped}%, #edf2f7 0)` }}
        >
          <div className="absolute inset-[6px] flex items-center justify-center rounded-full bg-white text-sm font-semibold text-navy">
            {clamped}%
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold text-navy">{category}</div>
          <div className="mt-1 text-xs font-medium text-neutral-500">
            {fmtRp(spent)} / {fmtRp(budget)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_44px] gap-2 min-[420px]:grid-cols-[minmax(0,1fr)_92px]">
        <label htmlFor={`budget-${category}`} className="sr-only">
          Set budget untuk {category}
        </label>
        <div className="relative min-w-0">
          <PiggyBank size={15} className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${tone.text}`} />
          <input
            id={`budget-${category}`}
            type="text"
            inputMode="decimal"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="1.500.000"
            className={`h-11 w-full rounded-full border bg-white/70 pl-9 pr-4 text-sm font-medium text-navy outline-none backdrop-blur ${tone.border}`}
          />
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className={`flex h-11 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold disabled:opacity-60 ${tone.bg} ${tone.text}`}
          title="Simpan budget"
        >
          <Save size={15} />
          <span className="hidden min-[420px]:inline">{saving ? "..." : "Simpan"}</span>
        </button>
      </div>

      <div className="soft-progress h-2.5 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${clamped}%`, backgroundColor: tone.color }} />
      </div>
    </div>
  );
}
