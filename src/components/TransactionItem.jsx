import { fmtRp } from "../utils/format.js";
import { ArrowDownLeft, ArrowUpRight, Car, FileText, Gift, ShoppingCart, Utensils } from "lucide-react";

function iconFor(tx) {
  if (tx.type === "income") return Gift;
  const text = `${tx.category || ""} ${tx.note || ""}`.toLowerCase();
  if (text.includes("makan") || text.includes("dapur")) return Utensils;
  if (text.includes("bensin") || text.includes("transport") || text.includes("ojol")) return Car;
  if (text.includes("belanja")) return ShoppingCart;
  return FileText;
}

export default function TransactionItem({ tx }) {
  const isIncome = tx.type === "income";
  const Icon = iconFor(tx);

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-neutral-border/70 py-3 last:border-0">
      <div className="flex min-w-0 items-center gap-3">
        <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${isIncome ? "bg-mint-light text-mint" : "bg-coral-light text-coral"}`}>
          <Icon size={21} strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-navy">{tx.category}</div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500">
            {isIncome ? <ArrowUpRight size={13} className="text-mint" /> : <ArrowDownLeft size={13} className="text-coral" />}
            <span className="truncate">{isIncome ? "Pemasukan" : "Pengeluaran"}</span>
          </div>
          <div className="mt-0.5 truncate text-[11px] text-neutral-500">
            {tx.date}
            {tx.note ? ` · ${tx.note}` : ""}
          </div>
          {(tx.creator_name || tx.creator_email) && (
            <div className="mt-0.5 truncate text-[10px] text-neutral-500">
              Dicatat oleh {tx.creator_name || tx.creator_email}
            </div>
          )}
        </div>
      </div>
      <div className={`whitespace-nowrap pl-2 text-base font-semibold ${isIncome ? "text-mint" : "text-coral"}`}>
        {isIncome ? "+" : "-"}
        {fmtRp(tx.amount)}
      </div>
    </div>
  );
}
