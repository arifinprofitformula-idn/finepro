import { CalendarDays } from "lucide-react";
import { fmtRp } from "../utils/format.js";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des"
];

function rangeLabel() {
  const today = new Date();
  return `1 s.d Hari Ini (${today.getDate()} ${MONTH_LABELS[today.getMonth()]})`;
}

function signedRp(value, sign) {
  if (!value) return "-";
  return `${sign}${fmtRp(value)}`;
}

export default function DailySummaryCard({ rows }) {
  return (
    <div className="gloss-panel mb-4 rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-light text-violet">
            <CalendarDays size={16} />
          </div>
          <h2 className="truncate text-base font-semibold text-navy">Ringkasan Harian</h2>
        </div>
        <span className="flex-shrink-0 rounded-xl bg-neutral-100 px-3 py-1.5 text-[11px] font-semibold text-neutral-500">
          {rangeLabel()}
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-border/60 bg-white/45">
        <div className="max-h-64 overflow-auto">
          <table className="w-full min-w-[430px] border-collapse text-sm">
            <thead className="sticky top-0 z-[1] bg-neutral-50">
              <tr className="border-b border-neutral-border/60 text-[11px] font-semibold uppercase text-neutral-500">
                <th className="w-12 px-3 py-3 text-left">Tgl</th>
                <th className="px-3 py-3 text-right">Pemasukan</th>
                <th className="px-3 py-3 text-right">Pengeluaran</th>
                <th className="px-3 py-3 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.day} className="border-b border-neutral-border/50 last:border-0">
                  <td className="px-3 py-3 text-sm font-medium text-neutral-500">{row.day}</td>
                  <td className="px-3 py-3 text-right text-sm font-semibold text-mint">
                    {signedRp(row.income, "+")}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-semibold text-coral">
                    {signedRp(row.expense, "-")}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-semibold text-navy">
                    {fmtRp(row.balance)}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-3 py-8 text-center text-sm font-medium text-neutral-500">
                    Belum ada transaksi hari ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
