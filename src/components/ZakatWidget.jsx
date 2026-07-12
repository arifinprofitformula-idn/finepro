import { useEffect, useState } from "react";
import { HandHeart } from "lucide-react";
import { getZakatSummary } from "../api/transactions.js";
import { fmtRp, monthLabel } from "../utils/format.js";

export default function ZakatWidget({ householdId, totalExpense = 0, monthKey }) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    getZakatSummary(monthKey).then(setSummary).catch(() => setSummary(null));
  }, [householdId, monthKey]);

  if (!summary) return null;
  const operationalExpense = Math.max(0, Number(totalExpense) - Number(summary.thisMonth || 0));

  return (
    <div className="gloss-panel mb-4 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gold-light text-gold">
            <HandHeart size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-navy">Zakat & Sedekah {monthLabel(monthKey, { short: true })}</div>
            {summary.streakMonths > 1 && (
              <div className="text-xs font-medium text-neutral-500">
                {summary.streakMonths} bulan berturut-turut tercatat
              </div>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 text-right text-sm font-bold text-navy">{fmtRp(summary.thisMonth)}</div>
      </div>
      <div className="mt-3 rounded-xl bg-white/55 px-3 py-2 text-xs font-medium text-neutral-500">
        Pengeluaran operasional di luar pos ini: <span className="font-semibold text-navy">{fmtRp(operationalExpense)}</span>
      </div>
    </div>
  );
}
