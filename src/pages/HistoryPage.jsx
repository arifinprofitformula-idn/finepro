// src/pages/HistoryPage.jsx
// Riwayat transaksi lengkap: cari + filter + cursor pagination ("Muat Lebih
// Banyak", BUKAN fetch semua transaksi sekaligus — lihat alasan keyset
// pagination di api/routes/transactions.js), plus unduh CSV (memakai filter
// aktif) dan cadangan JSON penuh (tidak terpengaruh filter).

import { useEffect, useMemo, useState, useCallback } from "react";
import TransactionItem from "../components/TransactionItem.jsx";
import TransactionModal from "../components/TransactionModal.jsx";
import { useTransactionHistory } from "../hooks/useTransactionHistory.js";
import { cancelTransactionDraft, confirmTransactionDraft, deleteTransaction, downloadBackup, exportTransactionsCsv, getPendingTransactionDrafts, updateTransaction } from "../api/transactions.js";
import { getWallets } from "../api/wallets.js";
import { fmtRp, monthLabel, monthRangeFromKey } from "../utils/format.js";
import { AlertCircle, Archive, CalendarDays, CheckCircle2, Download, Loader2, Search, XCircle } from "lucide-react";

export default function HistoryPage({ household, categoriesExpense, categoriesIncome, onDataChanged, selectedMonthKey }) {
  const periodRange = useMemo(() => monthRangeFromKey(selectedMonthKey), [selectedMonthKey]);
  const periodFilters = useMemo(() => ({ type: "", category: "", wallet_id: "", search: "", ...periodRange }), [periodRange]);
  const { filters, transactions, hasMore, loading, loadingMore, applyFilters, loadMore, refresh, defaultFilters } = useTransactionHistory(periodFilters);
  const [searchInput, setSearchInput] = useState("");
  const [wallets, setWallets] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [draftActionId, setDraftActionId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [editingTx, setEditingTx] = useState(null);

  useEffect(() => {
    getWallets().then(setWallets).catch(() => setWallets([]));
  }, [household.id]);

  async function refreshDrafts() {
    setDraftsLoading(true);
    try {
      setDrafts(await getPendingTransactionDrafts(20));
    } catch (err) {
      console.error("Gagal memuat draft transaksi", err);
      setDrafts([]);
    } finally {
      setDraftsLoading(false);
    }
  }

  const memoRefreshDrafts = useCallback(refreshDrafts, []);

  useEffect(() => {
    memoRefreshDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household.id, memoRefreshDrafts]);

  // Debounce pencarian catatan — hindari fetch tiap ketikan.
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== filters.search) applyFilters({ ...filters, search: searchInput });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function updateFilter(key, value) {
    applyFilters({ ...filters, [key]: value });
  }

  function applyActivePeriod() {
    setSearchInput("");
    applyFilters({ ...defaultFilters, ...periodRange });
  }

  const allCategories = [...categoriesExpense, ...categoriesIncome].map((c) => c.name).filter((v, i, arr) => arr.indexOf(v) === i);

  async function handleExportCsv() {
    setExporting(true);
    try {
      await exportTransactionsCsv(filters);
    } catch (err) {
      alert("Gagal mengunduh CSV: " + err.message);
    } finally {
      setExporting(false);
    }
  }

  async function handleBackup() {
    if (!confirm("Cadangan berisi seluruh data household (transaksi, dompet, budget, tagihan, kategori, arisan) dan bisa berukuran besar. Lanjutkan unduh?")) {
      return;
    }
    setBackingUp(true);
    try {
      await downloadBackup();
    } catch (err) {
      alert("Gagal membuat cadangan: " + err.message);
    } finally {
      setBackingUp(false);
    }
  }

  async function handleUpdateTransaction(payload) {
    if (!editingTx?.id) return;
    await updateTransaction(editingTx.id, payload);
    setEditingTx(null);
    await refresh();
    await onDataChanged?.();
  }

  async function handleDeleteTransaction(tx) {
    if (!confirm(`Hapus transaksi ${tx.category} senilai ${Number(tx.amount).toLocaleString("id-ID")} ?`)) {
      return;
    }
    try {
      await deleteTransaction(tx.id);
      await refresh();
      await onDataChanged?.();
    } catch (err) {
      alert("Gagal menghapus transaksi: " + err.message);
    }
  }

  async function handleConfirmDraft(draft) {
    const a = draft.analysis || {};
    const amount = Number(a.amount || 0);
    if (!confirm(`Konfirmasi draft ${a.category || 'Lainnya'} senilai ${fmtRp(amount)}?`)) return;

    setDraftActionId(draft.id);
    try {
      await confirmTransactionDraft(draft.id);
      await refreshDrafts();
      await refresh();
      await onDataChanged?.();
    } catch (err) {
      alert("Gagal mengonfirmasi draft: " + err.message);
    } finally {
      setDraftActionId(null);
    }
  }

  async function handleCancelDraft(draft) {
    const a = draft.analysis || {};
    const amount = Number(a.amount || 0);
    if (!confirm(`Batalkan draft ${a.category || 'transaksi'} senilai ${fmtRp(amount)}?`)) return;

    setDraftActionId(draft.id);
    try {
      await cancelTransactionDraft(draft.id);
      await refreshDrafts();
    } catch (err) {
      alert("Gagal membatalkan draft: " + err.message);
    } finally {
      setDraftActionId(null);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-5 pb-28">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-navy">Riwayat Transaksi</h1>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={exporting}
          className="flex flex-1 min-h-[44px] items-center justify-center gap-2 rounded-full border border-violet text-sm font-semibold text-violet disabled:opacity-60"
        >
          {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          Unduh CSV
        </button>
        <button
          type="button"
          onClick={handleBackup}
          disabled={backingUp}
          className="flex flex-1 min-h-[44px] items-center justify-center gap-2 rounded-full border border-navy/30 text-sm font-semibold text-navy disabled:opacity-60"
        >
          {backingUp ? <Loader2 size={16} className="animate-spin" /> : <Archive size={16} />}
          Cadangan
        </button>
      </div>

      <div className="gloss-panel mb-4 rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl bg-white/55 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-light text-violet">
              <CalendarDays size={15} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-bold text-navy">Periode aktif: {monthLabel(selectedMonthKey)}</div>
              <div className="text-[11px] font-medium text-neutral-500">Riwayat mengikuti bulan pilihan dashboard.</div>
            </div>
          </div>
          <button
            type="button"
            onClick={applyActivePeriod}
            className="flex-shrink-0 rounded-full bg-violet-light px-3 py-1.5 text-[11px] font-bold text-violet"
          >
            Terapkan
          </button>
        </div>

        <div className="relative mb-3">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Cari catatan..."
            className="w-full rounded-full border border-white/80 bg-white/70 py-2.5 pl-9 pr-3 text-sm font-medium text-navy outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <select
            value={filters.type}
            onChange={(e) => updateFilter("type", e.target.value)}
            className="rounded-xl border border-white/80 bg-white/70 px-2.5 py-2 text-xs font-medium text-navy outline-none"
          >
            <option value="">Semua Jenis</option>
            <option value="income">Pemasukan</option>
            <option value="expense">Pengeluaran</option>
          </select>

          <select
            value={filters.category}
            onChange={(e) => updateFilter("category", e.target.value)}
            className="rounded-xl border border-white/80 bg-white/70 px-2.5 py-2 text-xs font-medium text-navy outline-none"
          >
            <option value="">Semua Kategori</option>
            {allCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {wallets.length > 1 && (
            <select
              value={filters.wallet_id}
              onChange={(e) => updateFilter("wallet_id", e.target.value)}
              className="rounded-xl border border-white/80 bg-white/70 px-2.5 py-2 text-xs font-medium text-navy outline-none"
            >
              <option value="">Semua Dompet</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          )}

          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => updateFilter("date_from", e.target.value)}
            className="rounded-xl border border-white/80 bg-white/70 px-2.5 py-2 text-xs font-medium text-navy outline-none"
          />
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => updateFilter("date_to", e.target.value)}
            className="rounded-xl border border-white/80 bg-white/70 px-2.5 py-2 text-xs font-medium text-navy outline-none"
          />

          {(filters.type || filters.category || filters.wallet_id || filters.date_from || filters.date_to || filters.search) && (
            <button
              type="button"
              onClick={() => { setSearchInput(""); applyFilters({ ...defaultFilters, ...periodRange }); }}
              className="col-span-2 min-h-[36px] rounded-xl text-xs font-semibold text-coral"
            >
              Reset ke Periode Aktif
            </button>
          )}
        </div>
      </div>

      {drafts.length > 0 && (
        <div className="gloss-panel mb-4 rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-800">
              <AlertCircle size={17} />
              Draft dari WhatsApp/Telegram
            </div>
            {draftsLoading && <Loader2 size={16} className="animate-spin text-amber-700" />}
          </div>
          <div className="space-y-2">
            {drafts.map((draft) => {
              const a = draft.analysis || {};
              const isBusy = draftActionId === draft.id;
              const typeLabel = a.transaction_type === 'income' ? 'Pemasukan' : 'Pengeluaran';
              const merchant = a.merchant ? ` — ${a.merchant}` : '';
              return (
                <div key={draft.id} className="rounded-2xl bg-white/80 p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-navy">
                        {typeLabel} {fmtRp(Number(a.amount || 0))}
                      </div>
                      <div className="mt-0.5 text-xs font-medium text-neutral-600">
                        {a.category || 'Belum dikategorikan'}{merchant}
                      </div>
                      <div className="mt-0.5 text-[11px] font-medium text-neutral-400">
                        {a.source_wallet_name || 'Dompet belum pasti'} · {a.transaction_date || 'Tanggal belum pasti'} · {draft.source_channel || 'bot'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleConfirmDraft(draft)}
                      disabled={isBusy}
                      className="flex min-h-[38px] items-center justify-center gap-1.5 rounded-full bg-mint px-3 text-xs font-bold text-white disabled:opacity-60"
                    >
                      {isBusy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      Konfirmasi
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancelDraft(draft)}
                      disabled={isBusy}
                      className="flex min-h-[38px] items-center justify-center gap-1.5 rounded-full border border-coral/30 px-3 text-xs font-bold text-coral disabled:opacity-60"
                    >
                      <XCircle size={14} />
                      Batalkan
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="gloss-panel rounded-2xl p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm font-semibold text-neutral-500">
            <Loader2 size={18} className="mr-2 animate-spin" />
            Memuat...
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-8 text-center text-sm font-semibold text-neutral-500">
            Tidak ada transaksi yang cocok dengan filter ini.
          </div>
        ) : (
          <>
            {transactions.map((tx) => (
              <TransactionItem
                key={tx.id}
                tx={tx}
                onEdit={setEditingTx}
                onDelete={handleDeleteTransaction}
              />
            ))}
            {hasMore && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-violet text-sm font-semibold text-violet disabled:opacity-60"
              >
                {loadingMore && <Loader2 size={16} className="animate-spin" />}
                Muat Lebih Banyak
              </button>
            )}
          </>
        )}
      </div>

      <TransactionModal
        open={Boolean(editingTx)}
        onClose={() => setEditingTx(null)}
        onSubmit={handleUpdateTransaction}
        categoriesExpense={categoriesExpense}
        categoriesIncome={categoriesIncome}
        isStudent={household.household_type === "student"}
        initialTransaction={editingTx}
      />
    </div>
  );
}
