import { fmtRp } from "../utils/format.js";
import { ArrowDownLeft, ArrowUpRight, Car, FileText, Gift, Pencil, ShoppingCart, Trash2, Utensils } from "lucide-react";

function iconFor(tx) {
  if (tx.type === "income") return Gift;
  const text = `${tx.category || ""} ${tx.note || ""}`.toLowerCase();
  if (text.includes("makan") || text.includes("dapur")) return Utensils;
  if (text.includes("bensin") || text.includes("transport") || text.includes("ojol")) return Car;
  if (text.includes("belanja")) return ShoppingCart;
  return FileText;
}

export default function TransactionItem({ tx, onEdit, onDelete }) {
  const isIncome = tx.type === "income";
  const Icon = iconFor(tx);
  const recorder = tx.creator_name || (tx.creator_email ? "Pengguna" : "");
  const hasActions = Boolean(onEdit || onDelete);

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-neutral-border/60 py-2.5 last:border-0">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${isIncome ? "bg-mint-light text-mint" : "bg-coral-light text-coral"}`}>
          <Icon size={18} strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-navy">{tx.category}</div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-neutral-500">
            {isIncome ? <ArrowUpRight size={13} className="text-mint" /> : <ArrowDownLeft size={13} className="text-coral" />}
            <span className="truncate">
              {isIncome ? "Pemasukan" : "Pengeluaran"} · {tx.date}
              {recorder ? ` · Oleh ${recorder}` : ""}
              {tx.note ? ` · ${tx.note}` : ""}
            </span>
          </div>
        </div>
      </div>
      <div className={`whitespace-nowrap pl-2 text-sm font-semibold ${isIncome ? "text-mint" : "text-coral"}`}>
        <div className="text-right">
          {isIncome ? "+" : "-"}
          {fmtRp(tx.amount)}
        </div>
        {hasActions && (
          <div className="mt-1 flex justify-end gap-1">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(tx)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-light text-violet"
                title="Edit transaksi"
                aria-label="Edit transaksi"
              >
                <Pencil size={14} />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(tx)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-coral-light text-coral"
                title="Hapus transaksi"
                aria-label="Hapus transaksi"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
