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

const BALANCE_STYLE = {
  safe: {
    text: "text-violet",
    halo: "bg-violet-light",
    indicator: "bg-violet",
    valueColor: "#3f2ca8",
    backgroundColor: "rgba(239, 234, 255, 0.82)",
    borderColor: "rgba(111, 85, 242, 0.22)",
    shadow: "0 14px 34px rgba(111, 85, 242, 0.14), inset 0 1px 0 rgba(255,255,255,0.82)"
  },
  warning: {
    text: "text-gold",
    halo: "bg-gold-light",
    indicator: "bg-gold",
    valueColor: "#8a641d",
    backgroundColor: "rgba(255, 247, 221, 0.88)",
    borderColor: "rgba(184, 137, 43, 0.24)",
    shadow: "0 14px 34px rgba(184, 137, 43, 0.14), inset 0 1px 0 rgba(255,255,255,0.84)"
  },
  danger: {
    text: "text-coral",
    halo: "bg-coral-light",
    indicator: "bg-coral",
    valueColor: "#c92f2f",
    backgroundColor: "rgba(255, 240, 239, 0.9)",
    borderColor: "rgba(255, 75, 75, 0.24)",
    shadow: "0 14px 34px rgba(255, 75, 75, 0.14), inset 0 1px 0 rgba(255,255,255,0.84)"
  }
};

export default function KpiCard({ label, value, tone, status = "safe" }) {
  const current = TONE[tone] || TONE.balance;
  const Icon = current.icon;
  const isBalance = tone === "balance";
  const balanceStyle = BALANCE_STYLE[status] || BALANCE_STYLE.safe;
  const visual = isBalance ? { ...current, ...balanceStyle } : current;

  return (
    <div
      className="gloss-panel flex min-h-[72px] items-center gap-3 rounded-2xl px-4 py-3"
      style={
        isBalance
          ? {
              backgroundColor: visual.backgroundColor,
              borderColor: visual.borderColor,
              boxShadow: visual.shadow
            }
          : undefined
      }
    >
      <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full ${visual.halo}`}>
        <Icon size={21} strokeWidth={2.6} className={visual.text} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={`text-xs font-medium ${isBalance ? visual.text : "text-neutral-500"}`}>{label}</div>
        <div
          className="mt-0.5 truncate text-lg font-semibold leading-tight text-navy"
          style={isBalance ? { color: visual.valueColor } : undefined}
        >
          {value}
        </div>
      </div>
      <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${visual.indicator}`} />
    </div>
  );
}
