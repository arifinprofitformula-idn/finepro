import { useEffect, useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { formatNumberIdInput, parseNumberId, todayStr } from "../utils/format.js";
import { getWallets } from "../api/wallets.js";
import { scanReceipt, getScanQuota } from "../api/receipts.js";
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Camera, NotebookPen, Tags, Wallet } from "lucide-react";

const STUDENT_QUICK_CATEGORIES = [
  "Uang Makan",
  "Kuota & Internet",
  "Transportasi (Ojol/Motor)",
  "Nongkrong & Hiburan"
];

export default function TransactionModal({ open, onClose, onSubmit, categoriesExpense, categoriesIncome, isStudent, initialTransaction = null }) {
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
  const [scanQuota, setScanQuota] = useState(null);

  const isEdit = Boolean(initialTransaction?.id);
  const currentCategories = type === "income" ? categoriesIncome : categoriesExpense;

  async function handleScanReceipt(e) {
    const file = e.target.files[0];
    if (!file) return;
    setScanning(true);
    setScanMsg("");
    try {
      const result = await scanReceipt(file);
      const nextType = result.type === "income" ? "income" : "expense";
      const nextCategories = nextType === "income" ? categoriesIncome : categoriesExpense;
      setType(nextType);
      if (result.date) setDate(result.date);
      if (result.amount) setAmount(formatNumberIdInput(result.amount));
      if (result.note) setNote(result.note);
      if (result.suggested_category) {
        const match = nextCategories.find(
          (c) => c.name.toLowerCase().includes(result.suggested_category.toLowerCase()) ||
                 result.suggested_category.toLowerCase().includes(c.name.toLowerCase())
        );
        setCategory(match?.name || nextCategories[0]?.name || "");
      } else {
        setCategory(nextCategories[0]?.name || "");
      }
      setScanMsg("Terisi otomatis dari struk — cek dulu sebelum simpan.");
      setScanQuota((prev) => (prev ? { ...prev, used: prev.used + 1, remaining: Math.max(0, prev.remaining - 1) } : prev));
    } catch (err) {
      setScanMsg(err.message);
    } finally {
      setScanning(false);
      e.target.value = "";
    }
  }

  useEffect(() => {
    if (open) {
      const nextType = initialTransaction?.type || "expense";
      const nextCategoryList = nextType === "income" ? categoriesIncome : categoriesExpense;
      setType(nextType);
      setDate(initialTransaction?.date || todayStr());
      setAmount(initialTransaction?.amount ? formatNumberIdInput(initialTransaction.amount) : "");
      setNote(initialTransaction?.note || "");
      setCategory(initialTransaction?.category || nextCategoryList[0]?.name || "");
      getWallets()
        .then((w) => {
          setWallets(w);
          setWalletId(initialTransaction?.wallet_id || w.find((x) => x.is_default)?.id || w[0]?.id || "");
        })
        .catch(() => setWallets([]));
      if (initialTransaction?.id) {
        setScanQuota(null);
        setScanMsg("");
      } else {
        getScanQuota().then(setScanQuota).catch(() => setScanQuota(null));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTransaction?.id]);

  function handleTypeChange(next) {
    setType(next);
    const list = next === "income" ? categoriesIncome : categoriesExpense;
    setCategory(list[0]?.name || "");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const amt = parseNumberId(amount);
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
          <DialogTitle className="mb-4 text-xl font-semibold text-navy">
            {isEdit ? "Edit Transaksi" : "Tambah Transaksi"}
          </DialogTitle>
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

            {!isEdit && type === "expense" && (
              <div>
                <div className="relative">
                  <label
                    htmlFor="tx-scan-receipt"
                    aria-disabled={scanQuota?.remaining === 0}
                    className={`flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full border border-dashed text-sm font-semibold cursor-pointer ${
                      scanQuota?.remaining === 0
                        ? "border-neutral-300 text-neutral-400 cursor-not-allowed"
                        : "border-violet text-violet"
                    }`}
                  >
                    <Camera size={18} />
                    {scanning ? "Memindai struk..." : "Scan Struk (Otomatis Isi)"}
                  </label>
                  {scanQuota && (
                    <span
                      className={`absolute -top-2 -right-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        scanQuota.remaining === 0 ? "bg-coral-light text-coral" : "bg-violet-light text-violet"
                      }`}
                    >
                      {scanQuota.remaining}/{scanQuota.limit} kuota
                    </span>
                  )}
                </div>
                <input
                  id="tx-scan-receipt"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  capture="environment"
                  className="hidden"
                  disabled={scanning || scanQuota?.remaining === 0}
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
                type="text"
                inputMode="decimal"
                required
                value={amount}
                onChange={(e) => setAmount(formatNumberIdInput(e.target.value))}
                placeholder="1.500.000"
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
                {submitting ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Simpan"}
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
