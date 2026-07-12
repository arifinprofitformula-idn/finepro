import { CalendarDays } from "lucide-react";
import { currentMonthKey, fmtRp, monthKeyToParts } from "../utils/format.js";

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

function rangeLabel(monthKey) {
  const { year, month } = monthKeyToParts(monthKey);
  const today = new Date();
  const isCurrentMonth = monthKey === currentMonthKey();
  const lastDay = isCurrentMonth ? today.getDate() : new Date(year, month, 0).getDate();
  return `1 s.d ${lastDay} ${MONTH_LABELS[month - 1]}`;
}

function signedRp(value, sign) {
  if (!value) return "-";
  return `${sign}${fmtRp(value)}`;
}

export default function DailySummaryCard({ rows, monthKey }) {
  return (
    <div className="gloss-panel mb-4 rounded-2xl p-3.5 sm:p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-light text-violet">
            <CalendarDays size={16} />
          </div>
          <h2 className="text-base font-semibold leading-tight text-navy">Ringkasan Harian</h2>
        </div>
        <span className="w-fit rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold leading-none text-neutral-500 sm:flex-shrink-0">
          {rangeLabel(monthKey)}
        </span>
      </div>

      <div className="space-y-2 sm:hidden">
        {rows.map((row) => (
          <div key={row.day} className="rounded-xl border border-neutral-border/60 bg-white/50 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase text-neutral-500">Tanggal {row.day}</div>
              <div className="text-sm font-semibold text-navy">{fmtRp(row.balance)}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="font-medium text-neutral-400">Masuk</div>
                <div className="mt-0.5 font-semibold text-mint">{signedRp(row.income, "+")}</div>
              </div>
              <div className="text-right">
                <div className="font-medium text-neutral-400">Keluar</div>
                <div className="mt-0.5 font-semibold text-coral">{signedRp(row.expense, "-")}</div>
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="rounded-xl border border-neutral-border/60 bg-white/50 px-3 py-6 text-center text-sm font-medium text-neutral-500">
            Belum ada transaksi pada periode ini.
          </div>
        )}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-neutral-border/60 bg-white/45 sm:block">
        <div className="max-h-64 overflow-auto">
          <table className="w-full border-collapse text-sm">
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
                    Belum ada transaksi pada periode ini.
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
