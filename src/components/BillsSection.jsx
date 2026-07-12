// src/components/BillsSection.jsx
// Section "Tagihan" self-contained (pola sama dengan ZakatWidget.jsx) —
// banner pengingat jatuh tempo (≤5 hari), daftar tagihan, form tambah/edit.

import { useState } from "react";
import { useBills } from "../hooks/useBills.js";
import BillItem from "./BillItem.jsx";
import BillFormDialog from "./BillFormDialog.jsx";
import { fmtRp } from "../utils/format.js";
import { Bell, CalendarClock, Plus } from "lucide-react";

export default function BillsSection({ householdId }) {
  const { bills, upcoming, loading, addBill, editBill, markPaid, removeBill } = useBills(householdId);
  const [formOpen, setFormOpen] = useState(false);
  const [editingBill, setEditingBill] = useState(null);

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

  if (loading) return null;

  return (
    <div className="gloss-panel mb-4 rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-light text-gold">
            <CalendarClock size={16} />
          </div>
          <h2 className="text-base font-semibold text-navy">Tagihan</h2>
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
            <div key={b.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 py-0.5 text-xs font-medium">
              <span className="min-w-0 truncate">{b.name}</span>
              <span className="whitespace-nowrap">{fmtRp(b.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {bills.length === 0 ? (
        <div className="py-4 text-center text-sm font-medium text-neutral-500">
          Belum ada tagihan. Tekan + untuk menambah.
        </div>
      ) : (
        <div className="grid gap-2">
          {bills.map((bill) => (
            <BillItem key={bill.id} bill={bill} onMarkPaid={markPaid} onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <BillFormDialog open={formOpen} onClose={() => setFormOpen(false)} onSubmit={handleSubmit} bill={editingBill} />
    </div>
  );
}
