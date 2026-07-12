import { useEffect, useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { formatNumberIdInput, parseNumberId, todayStr } from "../utils/format.js";
import { getWallets } from "../api/wallets.js";
import { scanReceipt, getScanQuota } from "../api/receipts.js";
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Camera, NotebookPen, Sparkles, Tags, Wallet } from "lucide-react";

const STUDENT_QUICK_CATEGORIES = [
  "Uang Makan",
  "Kuota & Internet",
  "Transportasi (Ojol/Motor)",
  "Nongkrong & Hiburan"
];

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " dan ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreCategory(inputText, categoryName) {
  const input = normalizeText(inputText);
  const categoryText = normalizeText(categoryName);
  if (!input || !categoryText) return 0;
  if (input === categoryText) return 100;
  if (input.includes(categoryText) || categoryText.includes(input)) return 82;

  const inputTokens = new Set(input.split(" ").filter((token) => token.length > 2));
  const categoryTokens = categoryText.split(" ").filter((token) => token.length > 2);
  if (categoryTokens.length === 0) return 0;
  const hits = categoryTokens.filter((token) => inputTokens.has(token)).length;
  return hits > 0 ? Math.round((hits / categoryTokens.length) * 60) : 0;
}

function receiptCategoryHints(type, text) {
  const normalized = normalizeText(text);
  if (type === "income") {
    if (/\b(gaji|salary|upah|usaha|bisnis)\b/.test(normalized)) return ["gaji", "usaha"];
    if (/\b(beasiswa)\b/.test(normalized)) return ["beasiswa"];
    if (/\b(freelance|part time|parttime|kerja)\b/.test(normalized)) return ["freelance", "part", "kerja"];
    return ["transfer", "lainnya"];
  }

  if (/\b(makan|minum|food|resto|warung|cafe|kopi|dapur)\b/.test(normalized)) return ["uang makan", "kebutuhan pokok", "rumah tangga"];
  if (/\b(transport|ojol|gojek|grab|bensin|parkir|tol|motor|mobil)\b/.test(normalized)) return ["transportasi"];
  if (/\b(kuota|internet|pulsa|wifi|data)\b/.test(normalized)) return ["kuota", "internet"];
  if (/\b(kesehatan|obat|dokter|apotek|klinik)\b/.test(normalized)) return ["kesehatan"];
  if (/\b(sekolah|kuliah|buku|pendidikan)\b/.test(normalized)) return ["pendidikan", "kuliah", "buku"];
  if (/\b(zakat|sedekah|infaq|infak|donasi)\b/.test(normalized)) return ["zakat", "sedekah"];
  if (/\b(hiburan|nonton|game|nongkrong)\b/.test(normalized)) return ["hiburan", "nongkrong"];
  if (/\b(tabungan|investasi|saham|reksa|emas)\b/.test(normalized)) return ["tabungan", "investasi"];
  return ["lainnya"];
}

function buildScanCategoryOptions({ type, categories, suggestedCategory, note }) {
  const names = categories.map((item) => item.name).filter(Boolean);
  const unique = [];
  const add = (name) => {
    if (name && !unique.some((item) => normalizeText(item) === normalizeText(name))) unique.push(name);
  };

  const scanText = `${suggestedCategory || ""} ${note || ""}`.trim();
  const exactSuggested = names.find((name) => normalizeText(name) === normalizeText(suggestedCategory));
  const closeSuggested = names
    .map((name) => ({ name, score: scoreCategory(suggestedCategory, name) }))
    .sort((a, b) => b.score - a.score)[0];

  add(exactSuggested || (closeSuggested?.score >= 45 ? closeSuggested.name : suggestedCategory));

  receiptCategoryHints(type, scanText).forEach((hint) => {
    const match = names.find((name) => normalizeText(name).includes(normalizeText(hint)));
    add(match);
  });

  names
    .map((name) => ({ name, score: scoreCategory(scanText, name) }))
    .filter((item) => item.score >= 30)
    .sort((a, b) => b.score - a.score)
    .forEach((item) => add(item.name));

  if (unique.length < 2) {
    names.slice(0, 3).forEach(add);
  }

  return unique.filter((name) => names.includes(name)).slice(0, 5);
}

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
  const [scanCategoryOptions, setScanCategoryOptions] = useState([]);

  const isEdit = Boolean(initialTransaction?.id);
  const currentCategories = type === "income" ? categoriesIncome : categoriesExpense;
  const scanSourceLabel = type === "income" ? "bukti transfer" : "struk";
  const scanButtonLabel = type === "income" ? "Scan Bukti Transfer" : "Scan Struk (Otomatis Isi)";
  const scanningLabel = type === "income" ? "Memindai bukti transfer..." : "Memindai struk...";

  async function handleScanReceipt(e) {
    const file = e.target.files[0];
    if (!file) return;
    const intentType = type === "income" ? "income" : "expense";
    setScanning(true);
    setScanMsg("");
    try {
      const result = await scanReceipt(file, intentType);
      const nextType = intentType === "income" ? "income" : result.type === "income" ? "income" : "expense";
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
      setScanCategoryOptions(buildScanCategoryOptions({
        type: nextType,
        categories: nextCategories,
        suggestedCategory: result.suggested_category,
        note: result.note
      }));
      setScanMsg(
        nextType === "income"
          ? "Terisi otomatis dari bukti transfer — cek dulu sebelum simpan."
          : "Terisi otomatis dari struk — cek dulu sebelum simpan."
      );
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
        setScanCategoryOptions([]);
      } else {
        getScanQuota().then(setScanQuota).catch(() => setScanQuota(null));
        setScanMsg("");
        setScanCategoryOptions([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTransaction?.id]);

  function handleTypeChange(next) {
    setType(next);
    const list = next === "income" ? categoriesIncome : categoriesExpense;
    setCategory(list[0]?.name || "");
    setScanCategoryOptions([]);
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

            {!isEdit && (
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
                    {scanning ? scanningLabel : scanButtonLabel}
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

            {!isEdit && scanCategoryOptions.length > 0 && (
              <div className="rounded-2xl border border-violet/15 bg-violet-light/70 p-3">
                <div className="mb-2 flex items-start gap-2">
                  <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white text-violet">
                    <Sparkles size={14} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-navy">Kategori yang mungkin sesuai</div>
                    <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-neutral-500">
                      Kami pilih dari hasil baca {scanSourceLabel}. Ketuk kategori lain jika kurang pas.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {scanCategoryOptions.map((option, index) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setCategory(option)}
                      className={`min-h-[34px] rounded-full border px-3 text-xs font-bold transition active:scale-[0.98] ${
                        category === option
                          ? "border-violet bg-violet text-white shadow-soft"
                          : "border-white/80 bg-white/75 text-navy hover:border-violet/30"
                      }`}
                    >
                      {option}
                      {index === 0 && category === option ? " · default" : ""}
                    </button>
                  ))}
                </div>
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
