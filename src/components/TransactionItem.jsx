import { fmtRp } from "../utils/format.js";

export default function TransactionItem({ tx }) {
  const isIncome = tx.type === "income";
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-neutral-border last:border-0 min-h-[52px]">
      <div className="flex flex-col min-w-0">
        <div className="text-sm font-semibold text-neutral-900 truncate">{tx.category}</div>
        <div className="text-xs text-neutral-500 truncate">
          {tx.date}
          {tx.note ? ` · ${tx.note}` : ""}
        </div>
        {(tx.creator_name || tx.creator_email) && (
          <div className="text-[10px] text-neutral-500 mt-0.5 truncate">
            Dicatat oleh {tx.creator_name || tx.creator_email}
          </div>
        )}
      </div>
      <div className={`text-sm font-bold whitespace-nowrap pl-2 ${isIncome ? "text-success" : "text-danger"}`}>
        {isIncome ? "+" : "-"}
        {fmtRp(tx.amount)}
      </div>
    </div>
  );
}
