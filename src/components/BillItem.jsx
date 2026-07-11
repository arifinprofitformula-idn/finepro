// src/components/BillItem.jsx
// Baris compact tagihan — pola sama dengan TransactionItem.jsx.

import { fmtRp, daysUntilDate } from "../utils/format.js";
import { CalendarClock, CheckCircle2, Pencil, Repeat, Trash2 } from "lucide-react";

export default function BillItem({ bill, onMarkPaid, onEdit, onDelete }) {
  const isPaid = !!bill.paid_at && !bill.is_recurring;
  const d = daysUntilDate(bill.due_date);
  const overdue = !isPaid && d < 0;
  const dueSoon = !isPaid && d >= 0 && d <= 5;

  const statusColor = isPaid ? "text-mint" : overdue ? "text-coral" : dueSoon ? "text-gold" : "text-neutral-500";
  const statusText = isPaid
    ? "Lunas"
    : overdue
    ? `Telat ${-d} hari`
    : d === 0
    ? "Jatuh tempo hari ini"
    : `${d} hari lagi`;

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-neutral-border/70 py-3 last:border-0">
      <div className="flex min-w-0 items-center gap-3">
        <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${isPaid ? "bg-mint-light text-mint" : "bg-gold-light text-gold"}`}>
          {isPaid ? <CheckCircle2 size={21} strokeWidth={2.5} /> : <CalendarClock size={21} strokeWidth={2.5} />}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-navy">{bill.name}</div>
          <div className={`mt-1 flex items-center gap-1.5 text-xs font-medium ${statusColor}`}>
            {bill.is_recurring && <Repeat size={12} />}
            <span className="truncate">{statusText}</span>
          </div>
          <div className="mt-0.5 truncate text-[11px] text-neutral-500">
            Jatuh tempo {bill.due_date}
            {bill.category ? ` · ${bill.category}` : ""}
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <div className="whitespace-nowrap text-base font-semibold text-navy">{fmtRp(bill.amount)}</div>
        <div className="flex items-center gap-1">
          {!isPaid && (
            <button
              type="button"
              onClick={() => onMarkPaid(bill.id)}
              className="flex h-8 min-w-[8rem] items-center justify-center gap-1 rounded-full bg-mint-light px-2 text-[11px] font-semibold text-mint"
            >
              <CheckCircle2 size={13} />
              Tandai Lunas
            </button>
          )}
          <button type="button" onClick={() => onEdit(bill)} className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500">
            <Pencil size={15} />
          </button>
          <button type="button" onClick={() => onDelete(bill.id)} className="flex h-8 w-8 items-center justify-center rounded-full text-coral">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
