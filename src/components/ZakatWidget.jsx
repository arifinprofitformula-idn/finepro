import { useEffect, useState } from "react";
import { HandHeart } from "lucide-react";
import { getZakatSummary } from "../api/transactions.js";
import { fmtRp } from "../utils/format.js";

export default function ZakatWidget({ householdId }) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    getZakatSummary().then(setSummary).catch(() => setSummary(null));
  }, [householdId]);

  if (!summary) return null;

  return (
    <div className="gloss-panel mb-4 flex items-center justify-between rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-light text-gold">
          <HandHeart size={16} />
        </div>
        <div>
          <div className="text-sm font-semibold text-navy">Zakat & Sedekah bulan ini</div>
          {summary.streakMonths > 1 && (
            <div className="text-xs font-medium text-neutral-500">
              {summary.streakMonths} bulan berturut-turut tercatat
            </div>
          )}
        </div>
      </div>
      <div className="text-sm font-bold text-navy">{fmtRp(summary.thisMonth)}</div>
    </div>
  );
}
