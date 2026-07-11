import { fmtRp } from "../utils/format.js";

const RING_COLOR = { ok: "#1f8a56", warn: "#b8892b", over: "#c0392b" };

function ringColorFor(pct) {
  if (pct < 80) return RING_COLOR.ok;
  if (pct <= 100) return RING_COLOR.warn;
  return RING_COLOR.over;
}

export default function BudgetRow({ category, budget, spent, pct, inputValue, onInputChange, onSave, saving }) {
  const color = ringColorFor(pct);
  const clamped = Math.min(pct, 100);

  return (
    <div className="py-2.5 border-b border-neutral-border last:border-0">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-full flex-shrink-0 relative"
            style={{ background: `conic-gradient(${color} ${clamped}%, #f1efe9 0)` }}
          >
            <div className="absolute inset-[5px] rounded-full bg-white" />
          </div>
          <div className="text-sm font-semibold text-neutral-900 truncate">{category}</div>
        </div>
        <div className="text-xs text-neutral-500 whitespace-nowrap">
          {fmtRp(spent)} / {fmtRp(budget)}
        </div>
      </div>
      <div className="flex gap-2">
        <label htmlFor={`budget-${category}`} className="sr-only">
          Set budget untuk {category}
        </label>
        <input
          id={`budget-${category}`}
          type="number"
          min="0"
          step="1000"
          value={inputValue}
          onChange={onInputChange}
          placeholder="Set budget"
          className="flex-1 min-w-0 min-h-[40px] px-3 text-sm rounded-lg border border-neutral-border"
        />
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="min-h-[40px] px-3 rounded-lg border border-navy text-navy text-xs font-semibold disabled:opacity-60"
        >
          Simpan
        </button>
      </div>
    </div>
  );
}
