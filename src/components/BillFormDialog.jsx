// src/components/BillFormDialog.jsx
// Form tambah/edit tagihan — pola Dialog sama dengan TransactionModal.jsx.

import { useEffect, useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { formatNumberIdInput, parseNumberId, todayStr } from "../utils/format.js";
import { CalendarDays, Hash, NotebookPen, Repeat, Wallet } from "lucide-react";

export default function BillFormDialog({ open, onClose, onSubmit, bill, categoriesExpense = [] }) {
  const isEdit = !!bill;
  const fallbackCategory = categoriesExpense.find((item) => item.name === "Lainnya")?.name || categoriesExpense[0]?.name || "";
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayStr());
  const [isRecurring, setIsRecurring] = useState(true);
  const [installmentTotal, setInstallmentTotal] = useState("");
  const [category, setCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(bill?.name || "");
    setAmount(bill ? formatNumberIdInput(bill.amount) : "");
    setDueDate(bill?.due_date || todayStr());
    setIsRecurring(bill ? bill.is_recurring : true);
    setInstallmentTotal(bill?.installment_total ? String(bill.installment_total) : "");
    setCategory(bill?.category || fallbackCategory);
  }, [open, bill, fallbackCategory]);

  async function handleSubmit(e) {
    e.preventDefault();
    const amt = parseNumberId(amount);
    const total = installmentTotal ? Number(installmentTotal) : null;
    if (!name.trim() || !dueDate || !amt || amt < 0) return;
    if (total !== null && (!Number.isInteger(total) || total < 1 || total > 360)) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        amount: amt,
        due_date: dueDate,
        is_recurring: isRecurring,
        installment_total: isRecurring ? total : null,
        category: category.trim() || fallbackCategory || null,
      });
      onClose();
    } catch (err) {
      alert("Gagal menyimpan tagihan: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-navy/35 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-end justify-center">
        <DialogPanel className="gloss-panel w-full max-w-md rounded-t-[30px] p-5 max-h-[85vh] overflow-y-auto">
          <DialogTitle className="mb-4 text-xl font-semibold text-navy">
            {isEdit ? "Ubah Tagihan & Pembayaran" : "Tambah Tagihan & Pembayaran"}
          </DialogTitle>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label htmlFor="bill-name" className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                <NotebookPen size={14} />
                Nama Tagihan
              </label>
              <input
                id="bill-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="mis. Listrik, Internet, Cicilan"
                className="w-full rounded-2xl border border-white/80 bg-white/70 px-3 py-3 text-sm font-medium text-navy outline-none"
              />
            </div>

            <div>
              <label htmlFor="bill-due-date" className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                <CalendarDays size={14} />
                Tanggal Jatuh Tempo
              </label>
              <input
                id="bill-due-date"
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-2xl border border-white/80 bg-white/70 px-3 py-3 text-sm font-medium text-navy outline-none"
              />
            </div>

            <div>
              <label htmlFor="bill-amount" className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                <Wallet size={14} />
                Nominal (Rp)
              </label>
              <input
                id="bill-amount"
                type="text"
                inputMode="decimal"
                required
                value={amount}
                onChange={(e) => setAmount(formatNumberIdInput(e.target.value))}
                placeholder="1.500.000"
                className="w-full rounded-2xl border border-white/80 bg-white/70 px-3 py-3 text-sm font-medium text-navy outline-none"
              />
            </div>

            <div>
              <label htmlFor="bill-category" className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                <NotebookPen size={14} />
                Kategori Pengeluaran
              </label>
              <select
                id="bill-category"
                required={categoriesExpense.length > 0}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-2xl border border-white/80 bg-white/70 px-3 py-3 text-sm font-medium text-navy outline-none"
              >
                {categoriesExpense.length === 0 && <option value="">Belum ada kategori</option>}
                {category && !categoriesExpense.some((item) => item.name === category) && (
                  <option value={category}>{category}</option>
                )}
                {categoriesExpense.map((item) => (
                  <option key={item.id || item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium text-navy">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="h-4 w-4 rounded accent-violet"
              />
              <Repeat size={14} className="text-neutral-500" />
              Berulang tiap bulan
            </label>

            {isRecurring && (
              <div>
                <label htmlFor="bill-installment-total" className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                  <Hash size={14} />
                  Jumlah Cicilan
                </label>
                <input
                  id="bill-installment-total"
                  type="number"
                  min="1"
                  max="360"
                  inputMode="numeric"
                  value={installmentTotal}
                  onChange={(e) => setInstallmentTotal(e.target.value)}
                  placeholder="Kosongkan untuk rutin tanpa batas"
                  className="w-full rounded-2xl border border-white/80 bg-white/70 px-3 py-3 text-sm font-medium text-navy outline-none"
                />
              </div>
            )}

            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 min-h-[48px] border border-violet text-violet rounded-full text-sm font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 min-h-[48px] bg-violet text-white rounded-full text-sm font-semibold shadow-soft disabled:opacity-60"
              >
                Simpan
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
