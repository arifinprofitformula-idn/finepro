import { useEffect, useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { todayStr } from "../utils/format.js";
import { getWallets } from "../api/wallets.js";
import { scanReceipt } from "../api/transactions.js";
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Camera, NotebookPen, Tags, Wallet } from "lucide-react";

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
  const [wallets, setWallets] = useState([]);
  const [walletId, setWalletId] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState("");

  const currentCategories = type === "income" ? categoriesIncome : categoriesExpense;

  async function handleScanReceipt(e) {
    const file = e.target.files[0];
    if (!file) return;
    setScanning(true);
    setScanMsg("");
    try {
      const result = await scanReceipt(file);
      if (result.date) setDate(result.date);
      if (result.amount) setAmount(String(result.amount));
      if (result.note) setNote(result.note);
      if (result.suggested_category) {
        const match = categoriesExpense.find(
          (c) => c.name.toLowerCase().includes(result.suggested_category.toLowerCase()) ||
                 result.suggested_category.toLowerCase().includes(c.name.toLowerCase())
        );
        if (match) setCategory(match.name);
      }
      setScanMsg("Terisi otomatis dari struk — cek dulu sebelum simpan.");
    } catch (err) {
      setScanMsg(err.message);
    } finally {
      setScanning(false);
      e.target.value = "";
    }
  }

  useEffect(() => {
    if (open) {
      setType("expense");
      setDate(todayStr());
      setAmount("");
      setNote("");
      setCategory(categoriesExpense[0]?.name || "");
      getWallets()
        .then((w) => {
          setWallets(w);
          setWalletId(w.find((x) => x.is_default)?.id || w[0]?.id || "");
        })
        .catch(() => setWallets([]));
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
      await onSubmit({ date, type, category, amount: amt, note, wallet_id: walletId || undefined });
      onClose();
    } catch (err) {
      alert("Gagal menyimpan transaksi: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-navy/35 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-end justify-center">
        <DialogPanel className="gloss-panel w-full max-w-md rounded-t-[30px] p-5 max-h-[85vh] overflow-y-auto">
          <DialogTitle className="mb-4 text-xl font-semibold text-navy">Tambah Transaksi</DialogTitle>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleTypeChange("expense")}
                className={`flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-full border text-sm font-semibold ${
                  type === "expense" ? "bg-coral-light border-coral text-coral" : "border-white/80 bg-white/60 text-neutral-500"
                }`}
              >
                <ArrowDownLeft size={18} />
                Pengeluaran
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange("income")}
                className={`flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-full border text-sm font-semibold ${
                  type === "income" ? "bg-mint-light border-mint text-mint" : "border-white/80 bg-white/60 text-neutral-500"
                }`}
              >
                <ArrowUpRight size={18} />
                Pemasukan
              </button>
            </div>

            {type === "expense" && (
              <div>
                <label
                  htmlFor="tx-scan-receipt"
                  className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full border border-dashed border-violet text-sm font-semibold text-violet cursor-pointer"
                >
                  <Camera size={18} />
                  {scanning ? "Memindai struk..." : "Scan Struk (Otomatis Isi)"}
                </label>
                <input
                  id="tx-scan-receipt"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  capture="environment"
                  className="hidden"
                  disabled={scanning}
                  onChange={handleScanReceipt}
                />
                {scanMsg && <p className="mt-1 text-xs text-neutral-500">{scanMsg}</p>}
              </div>
            )}

            <div>
              <label htmlFor="tx-date" className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                <CalendarDays size={14} />
                Tanggal
              </label>
              <input
                id="tx-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-2xl border border-white/80 bg-white/70 px-3 py-3 text-sm font-medium text-navy outline-none"
              />
            </div>

            {isStudent && type === "expense" && (
              <div className="flex flex-wrap gap-1.5">
                {STUDENT_QUICK_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={`min-h-[40px] px-3 rounded-full border text-xs font-medium ${
                      category === c ? "bg-violet border-violet text-white" : "border-white/80 bg-white/60 text-navy"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}

            <div>
              <label htmlFor="tx-category" className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                <Tags size={14} />
                Kategori
              </label>
              <select
                id="tx-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-2xl border border-white/80 bg-white/70 px-3 py-3 text-sm font-medium text-navy outline-none"
              >
                {currentCategories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="tx-amount" className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                <Wallet size={14} />
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
                className="w-full rounded-2xl border border-white/80 bg-white/70 px-3 py-3 text-sm font-medium text-navy outline-none"
              />
            </div>

            {wallets.length > 1 && (
              <div>
                <label htmlFor="tx-wallet" className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                  <Wallet size={14} />
                  Dompet
                </label>
                <select
                  id="tx-wallet"
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                  className="w-full rounded-2xl border border-white/80 bg-white/70 px-3 py-3 text-sm font-medium text-navy outline-none"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="tx-note" className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                <NotebookPen size={14} />
                Catatan
              </label>
              <input
                id="tx-note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="mis. struk Indomaret"
                className="w-full rounded-2xl border border-white/80 bg-white/70 px-3 py-3 text-sm font-medium text-navy outline-none"
              />
            </div>

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
