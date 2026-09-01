// src/components/BillsSection.jsx
// Section "Tagihan" self-contained (pola sama dengan ZakatWidget.jsx) —
// banner pengingat jatuh tempo (≤5 hari), daftar tagihan, form tambah/edit.

import { useState } from "react";
import { useBills } from "../hooks/useBills.js";
import BillItem from "./BillItem.jsx";
import BillFormDialog from "./BillFormDialog.jsx";
import { fmtRp } from "../utils/format.js";
import { Bell, CalendarClock, Plus } from "lucide-react";

export default function BillsSection({ householdId, categoriesExpense = [], onDataChanged }) {
  const { bills, upcoming, loading, addBill, editBill, markPaid, removeBill } = useBills(householdId);
  const [formOpen, setFormOpen] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const activeBills = bills.filter((bill) => {
    const total = bill.installment_total ? Number(bill.installment_total) : null;
    const paid = Number(bill.paid_count || 0);
    return !bill.paid_at && (!total || paid < total);
  });
  const monthlyTotal = activeBills.reduce((sum, bill) => sum + Number(bill.amount || 0), 0);
  const paidThisMonthCount = bills.filter((bill) => bill.current_month_paid).length;

  function openAdd() {
    setEditingBill(null);
    setFormOpen(true);
  }

  function openEdit(bill) {
    setEditingBill(bill);
    setFormOpen(true);
  }

  async function handleSubmit(payload) {
    if (editingBill) {
      await editBill(editingBill.id, payload);
    } else {
      await addBill(payload);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Hapus tagihan ini?")) return;
    await removeBill(id);
  }

  async function handleMarkPaid(id) {
    await markPaid(id);
    await onDataChanged?.();
  }

  if (loading) return null;

  return (
    <div className="gloss-panel mb-4 rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-light text-gold">
            <CalendarClock size={16} />
          </div>
          <div>
            <h2 className="text-base font-semibold leading-tight text-navy">Tagihan & Pembayaran</h2>
            <p className="mt-0.5 text-xs font-medium text-neutral-500">{fmtRp(monthlyTotal)} per bulan</p>
          </div>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-light text-violet"
          aria-label="Tambah tagihan"
        >
          <Plus size={18} />
        </button>
      </div>

      {upcoming.length > 0 && (
        <div className="mb-3 rounded-2xl bg-gold-light/80 p-3 text-sm font-medium text-gold">
          <div className="mb-2 flex items-center gap-2">
            <Bell size={16} />
            {upcoming.length} tagihan jatuh tempo dalam 5 hari
          </div>
          {upcoming.slice(0, 3).map((b) => (
            <div key={b.id} className="grid gap-0.5 py-1 text-xs font-medium sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-2">
              <span className="min-w-0 break-words">{b.name}</span>
              <span className="min-w-0 break-words sm:text-right sm:whitespace-nowrap">{fmtRp(b.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {bills.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white/55 p-3">
            <div className="text-[11px] font-semibold text-neutral-500">Aktif</div>
            <div className="mt-1 text-sm font-bold text-navy">{activeBills.length} tagihan</div>
          </div>
          <div className="rounded-2xl bg-white/55 p-3">
            <div className="text-[11px] font-semibold text-neutral-500">Bulan ini</div>
            <div className="mt-1 text-sm font-bold text-mint">{paidThisMonthCount} dibayar</div>
          </div>
        </div>
      )}

      {bills.length === 0 ? (
        <div className="py-4 text-center text-sm font-medium text-neutral-500">
          Belum ada tagihan. Tekan + untuk menambah.
        </div>
      ) : (
        <div className="grid gap-2">
          {bills.map((bill, index) => (
            <BillItem key={bill.id} bill={bill} index={index} onMarkPaid={handleMarkPaid} onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <BillFormDialog open={formOpen} onClose={() => setFormOpen(false)} onSubmit={handleSubmit} bill={editingBill} categoriesExpense={categoriesExpense} />
    </div>
  );
}
