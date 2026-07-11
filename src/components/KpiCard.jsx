import { ArrowDownLeft, ArrowUpRight, ChartPie } from "lucide-react";

const TONE = {
  income: {
    icon: ArrowUpRight,
    text: "text-mint",
    halo: "bg-mint-light",
    indicator: "bg-mint"
  },
  expense: {
    icon: ArrowDownLeft,
    text: "text-coral",
    halo: "bg-coral-light",
    indicator: "bg-coral"
  },
  balance: {
    icon: ChartPie,
    text: "text-violet",
    halo: "bg-violet-light",
    indicator: "bg-violet"
  }
};

export default function KpiCard({ label, value, tone }) {
  const current = TONE[tone] || TONE.balance;
  const Icon = current.icon;

  return (
    <div className="gloss-panel flex min-h-[72px] items-center gap-3 rounded-2xl px-4 py-3">
      <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full ${current.halo}`}>
        <Icon size={21} strokeWidth={2.6} className={current.text} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-neutral-500">{label}</div>
        <div className="mt-0.5 truncate text-lg font-semibold leading-tight text-navy">{value}</div>
      </div>
      <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${current.indicator}`} />
    </div>
  );
}
