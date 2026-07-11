const TONE_BORDER = {
  income: "border-t-success",
  expense: "border-t-danger",
  balance: "border-t-gold"
};

export default function KpiCard({ label, value, tone }) {
  return (
    <div
      className={`min-w-[130px] flex-shrink-0 bg-white border border-neutral-border border-t-[3px] rounded-xl p-3 ${
        TONE_BORDER[tone] || ""
      }`}
    >
      <div className="text-[10px] uppercase tracking-wide text-neutral-500 mb-1">{label}</div>
      <div className="text-base font-bold text-neutral-900 whitespace-nowrap">{value}</div>
    </div>
  );
}
