import { useEffect, useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { todayStr } from "../utils/format.js";

const STUDENT_QUICK_CATEGORIES = [
  "Uang Makan",
  "Kuota & Internet",
  "Transportasi (Ojol/Motor)",
  "Nongkrong & Hiburan"
];

export default function TransactionModal({ open, onClose, onSubmit, categoriesExpense, categoriesIncome, isStudent }) {
  const [type, setType] = useState("expense");
  const [date, setDate] = useState(todayStr());
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const currentCategories = type === "income" ? categoriesIncome : categoriesExpense;

  useEffect(() => {
    if (open) {
      setType("expense");
      setDate(todayStr());
      setAmount("");
      setNote("");
      setCategory(categoriesExpense[0]?.name || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleTypeChange(next) {
    setType(next);
    const list = next === "income" ? categoriesIncome : categoriesExpense;
    setCategory(list[0]?.name || "");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!date || !amt || amt <= 0) return;
    setSubmitting(true);
    try {
      await onSubmit({ date, type, category, amount: amt, note });
      onClose();
    } catch (err) {
      alert("Gagal menyimpan transaksi: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-end justify-center">
        <DialogPanel className="w-full max-w-md bg-white rounded-t-2xl p-5 max-h-[85vh] overflow-y-auto">
          <DialogTitle className="text-[15px] font-bold text-neutral-900 mb-3">Tambah Transaksi</DialogTitle>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleTypeChange("expense")}
                className={`flex-1 min-h-[40px] rounded-lg border text-sm font-semibold ${
                  type === "expense" ? "bg-danger/10 border-danger text-danger" : "border-neutral-border text-neutral-500"
                }`}
              >
                Pengeluaran
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange("income")}
                className={`flex-1 min-h-[40px] rounded-lg border text-sm font-semibold ${
                  type === "income" ? "bg-success/10 border-success text-success" : "border-neutral-border text-neutral-500"
                }`}
              >
                Pemasukan
              </button>
            </div>

            <div>
              <label htmlFor="tx-date" className="block text-xs text-neutral-500 mb-1">
                Tanggal
              </label>
              <input
                id="tx-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-border"
              />
            </div>

            {isStudent && type === "expense" && (
              <div className="flex flex-wrap gap-1.5">
                {STUDENT_QUICK_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={`min-h-[40px] px-3 rounded-full border text-xs ${
                      category === c ? "bg-navy border-navy text-white" : "border-neutral-border text-neutral-900"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}

            <div>
              <label htmlFor="tx-category" className="block text-xs text-neutral-500 mb-1">
                Kategori
              </label>
              <select
                id="tx-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-border"
              >
                {currentCategories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="tx-amount" className="block text-xs text-neutral-500 mb-1">
                Nominal (Rp)
              </label>
              <input
                id="tx-amount"
                type="number"
                min="0"
                step="1000"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-border"
              />
            </div>

            <div>
              <label htmlFor="tx-note" className="block text-xs text-neutral-500 mb-1">
                Catatan
              </label>
              <input
                id="tx-note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="mis. struk Indomaret"
                className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-border"
              />
            </div>

            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 min-h-[44px] border border-navy text-navy rounded-lg text-sm font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 min-h-[44px] bg-navy text-white rounded-lg text-sm font-bold disabled:opacity-60"
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
