// src/pages/HistoryPage.jsx
// Riwayat transaksi lengkap: cari + filter + cursor pagination ("Muat Lebih
// Banyak", BUKAN fetch semua transaksi sekaligus — lihat alasan keyset
// pagination di api/routes/transactions.js), plus unduh CSV (memakai filter
// aktif) dan cadangan JSON penuh (tidak terpengaruh filter).

import { useEffect, useState } from "react";
import TransactionItem from "../components/TransactionItem.jsx";
import { useTransactionHistory } from "../hooks/useTransactionHistory.js";
import { exportTransactionsCsv, downloadBackup } from "../api/transactions.js";
import { getWallets } from "../api/wallets.js";
import { Archive, Download, Loader2, Search } from "lucide-react";

export default function HistoryPage({ household, categoriesExpense, categoriesIncome }) {
  const { filters, transactions, hasMore, loading, loadingMore, applyFilters, loadMore, defaultFilters } = useTransactionHistory();
  const [searchInput, setSearchInput] = useState("");
  const [wallets, setWallets] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  useEffect(() => {
    getWallets().then(setWallets).catch(() => setWallets([]));
  }, [household.id]);

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
              onClick={() => { setSearchInput(""); applyFilters(defaultFilters); }}
              className="col-span-2 min-h-[36px] rounded-xl text-xs font-semibold text-coral"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

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
              <TransactionItem key={tx.id} tx={tx} />
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
    </div>
  );
}
