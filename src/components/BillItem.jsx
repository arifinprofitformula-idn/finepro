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
    <div className="rounded-2xl border border-neutral-border/60 bg-white/55 p-3">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${isPaid ? "bg-mint-light text-mint" : "bg-gold-light text-gold"}`}>
          {isPaid ? <CheckCircle2 size={18} strokeWidth={2.3} /> : <CalendarClock size={18} strokeWidth={2.3} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-navy">{bill.name}</div>
              <div className="mt-0.5 truncate text-[11px] text-neutral-500">
                {bill.due_date}
                {bill.category ? ` · ${bill.category}` : ""}
              </div>
            </div>
            <div className="flex-shrink-0 text-right text-sm font-semibold text-navy">{fmtRp(bill.amount)}</div>
          </div>

          <div className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${statusColor}`}>
            {bill.is_recurring && <Repeat size={12} />}
            <span className="truncate">{statusText}</span>
          </div>

          <div className="mt-2 flex items-center gap-1">
            {!isPaid && (
              <button
                type="button"
                onClick={() => onMarkPaid(bill.id)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-mint-light text-mint"
                title="Tandai lunas"
                aria-label={`Tandai ${bill.name} lunas`}
              >
                <CheckCircle2 size={15} />
              </button>
            )}
            <button
              type="button"
              onClick={() => onEdit(bill)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-500"
              title="Ubah tagihan"
              aria-label={`Ubah ${bill.name}`}
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(bill.id)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-coral-light text-coral"
              title="Hapus tagihan"
              aria-label={`Hapus ${bill.name}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
