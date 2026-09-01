// src/components/BillItem.jsx
// Baris compact tagihan — pola sama dengan TransactionItem.jsx.

import { fmtRp, daysUntilDate, monthLabel } from "../utils/format.js";
import { CheckCircle2, Pencil, Repeat, Trash2 } from "lucide-react";

export default function BillItem({ bill, index = 0, onMarkPaid, onEdit, onDelete }) {
  const paidCount = Number(bill.paid_count || 0);
  const installmentTotal = bill.installment_total ? Number(bill.installment_total) : null;
  const installmentComplete = Boolean(installmentTotal && paidCount >= installmentTotal);
  const isPaid = (!!bill.paid_at && !bill.is_recurring) || installmentComplete;
  const paidThisMonth = Boolean(bill.current_month_paid);
  const canPayThisMonth = Boolean(bill.can_pay_current_month);
  const paidStatements = Array.isArray(bill.paid_statements) ? bill.paid_statements : [];
  const progressPct = installmentTotal ? Math.min(100, Math.round((paidCount / installmentTotal) * 100)) : 0;
  const cardClass = index % 2 === 0
    ? "border-neutral-border/60 bg-white/60"
    : "border-gold-light/70 bg-gold-light/18";
  const d = daysUntilDate(bill.due_date);
  const overdue = !isPaid && d < 0;
  const dueSoon = !isPaid && d >= 0 && d <= 5;

  const statusColor = isPaid || paidThisMonth ? "text-mint" : overdue ? "text-coral" : dueSoon ? "text-gold" : "text-neutral-500";
  const statusText = isPaid
    ? "Lunas"
    : paidThisMonth
    ? "Sudah dibayar"
    : overdue
    ? `Telat ${-d} hari`
    : d === 0
    ? "Jatuh tempo hari ini"
    : `${d} hari lagi`;
  const statementLabel = (statement) => {
    const period = statement.period_month ? monthLabel(statement.period_month, { short: true }) : null;
    return period || statement.due_date;
  };

  return (
    <div className={`rounded-2xl border p-3 ${cardClass}`}>
      <div className="min-w-0">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1.5">
          <div className="min-w-0">
            <div className="break-words text-sm font-semibold leading-snug text-navy">{bill.name}</div>
            <div className="mt-0.5 break-words text-[11px] leading-snug text-neutral-500">
              {bill.due_date}
              {bill.category ? ` · ${bill.category}` : ""}
            </div>
          </div>
          <span className={`flex max-w-[8rem] items-center justify-end gap-1 text-right text-[11px] font-semibold leading-tight ${statusColor}`}>
            {bill.is_recurring && <Repeat size={11} className="flex-shrink-0" />}
            <span className="break-words">
              {statusText}
            </span>
          </span>
          <div className="col-span-2 min-w-0 break-words text-sm font-semibold leading-snug text-navy sm:col-span-1 sm:col-start-2 sm:text-right sm:whitespace-nowrap">
            {fmtRp(bill.amount)}
          </div>
        </div>

        {installmentTotal && (
          <div className="mt-2">
            <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-semibold text-neutral-500">
              <span>{paidCount}/{installmentTotal} cicilan lunas</span>
              <span>{Math.max(installmentTotal - paidCount, 0)} lagi</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full rounded-full bg-mint transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        {paidStatements.length > 0 && (
          <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
            {paidStatements.slice(0, 4).map((statement) => (
              <span
                key={statement.id || statement.due_date}
                className="inline-flex max-w-full rounded-md border border-mint/15 bg-mint-light/70 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-mint"
                title={`Lunas ${statement.due_date}`}
              >
                <span className="min-w-0 break-words">
                  {statementLabel(statement)}
                </span>
              </span>
            ))}
            {paidStatements.length > 4 && (
              <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-neutral-500">
                +{paidStatements.length - 4}
              </span>
            )}
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => canPayThisMonth && onMarkPaid(bill.id)}
            disabled={!canPayThisMonth}
            className={`flex min-h-[32px] items-center gap-1.5 rounded-full px-3 text-xs font-bold ${
              canPayThisMonth ? "bg-mint-light text-mint" : "cursor-not-allowed bg-neutral-100 text-neutral-400"
            }`}
            title={canPayThisMonth ? "Tandai lunas dan catat pengeluaran" : paidThisMonth ? "Pembayaran bulan ini sudah dicatat" : "Pembayaran hanya aktif untuk bulan berjalan"}
            aria-label={canPayThisMonth ? `Tandai ${bill.name} lunas dan catat sebagai pengeluaran` : `${bill.name} belum bisa dibayar`}
          >
            <CheckCircle2 size={15} />
            {canPayThisMonth ? "Bayar bulan ini" : paidThisMonth ? "Sudah Dibayar" : isPaid ? "Lunas" : "Bulan berjalan"}
          </button>
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
  );
}
