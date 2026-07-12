import { fmtRp } from "../utils/format.js";
import { useEffect, useState } from "react";
import { Baby, Car, Check, CircleDollarSign, Gift, GraduationCap, HeartPulse, Home, Landmark, Pencil, PiggyBank, ShoppingBag, Smile, Utensils } from "lucide-react";

const RING_COLOR = { ok: "#18c594", warn: "#6f55f2", over: "#ff4b4b" };

function toneFor(pct) {
  if (pct < 80) return { key: "ok", color: RING_COLOR.ok, text: "text-mint", bg: "bg-mint-light", border: "border-mint" };
  if (pct <= 100) return { key: "warn", color: RING_COLOR.warn, text: "text-violet", bg: "bg-violet-light", border: "border-violet" };
  return { key: "over", color: RING_COLOR.over, text: "text-coral", bg: "bg-coral-light", border: "border-coral" };
}

function iconForCategory(category) {
  const text = category.toLowerCase();
  if (text.includes("rumah") || text.includes("pokok") || text.includes("kos") || text.includes("kontrakan")) return Home;
  if (text.includes("makan") || text.includes("dapur")) return Utensils;
  if (text.includes("transport") || text.includes("bensin") || text.includes("ojol")) return Car;
  if (text.includes("kesehatan")) return HeartPulse;
  if (text.includes("pendidikan") || text.includes("kuliah") || text.includes("buku")) return GraduationCap;
  if (text.includes("anak")) return Baby;
  if (text.includes("tabungan") || text.includes("investasi")) return PiggyBank;
  if (text.includes("ibadah") || text.includes("sedekah") || text.includes("zakat")) return Gift;
  if (text.includes("cicilan") || text.includes("utang")) return Landmark;
  if (text.includes("hiburan") || text.includes("nongkrong")) return Smile;
  if (text.includes("belanja")) return ShoppingBag;
  return CircleDollarSign;
}

export default function BudgetRow({ category, budget, spent, pct, inputValue, onInputChange, onSave, saving }) {
  const [editing, setEditing] = useState(false);
  const tone = toneFor(pct);
  const clamped = Math.min(pct, 100);
  const CategoryIcon = iconForCategory(category);

  useEffect(() => {
    if (!saving) setEditing(false);
  }, [saving]);

  return (
    <div className="border-b border-neutral-border/60 py-3 last:border-0">
      <div className="mb-2 flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${tone.bg} ${tone.text}`}>
            <CategoryIcon size={15} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-navy">{category}</div>
            <div className="mt-1 text-xs font-medium text-neutral-500">
              {fmtRp(spent)} / {fmtRp(budget)}
            </div>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone.bg} ${tone.text}`}>
            {clamped}%
          </span>
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-500"
              title={`Ubah budget ${category}`}
            >
              <Pencil size={14} />
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="mb-2 grid grid-cols-[minmax(0,1fr)_40px] gap-2">
          <label htmlFor={`budget-${category}`} className="sr-only">
            Set budget untuk {category}
          </label>
          <input
              id={`budget-${category}`}
              type="text"
              inputMode="decimal"
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="1.500.000"
              className={`h-10 w-full rounded-full border bg-white/70 px-4 text-sm font-medium text-navy outline-none backdrop-blur ${tone.border}`}
            />
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className={`flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-60 ${tone.bg} ${tone.text}`}
            title="Simpan budget"
          >
            <Check size={16} />
          </button>
        </div>
      )}

      <div className="soft-progress h-2 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${clamped}%`, backgroundColor: tone.color }} />
      </div>
    </div>
  );
}
