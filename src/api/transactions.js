// src/lib/transactions.js
// CRUD transaksi via API lokal

import { apiFetch, getToken } from "./apiClient.js";

export async function getMonthTransactions(householdId, monthKey) {
  const [year, month] = monthKey.split('-');
  const data = await apiFetch(`/transactions?month=${month}&year=${year}`);
  return data.transactions || [];
}

// Riwayat transaksi dengan filter + cursor pagination — dipakai HistoryPage.
// filters: { type, category, wallet_id, search, date_from, date_to }
export async function getTransactionHistory(filters = {}, cursor = null, limit = 20) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, v);
  });
  if (cursor) params.set('cursor', cursor);
  params.set('limit', limit);

  const data = await apiFetch(`/transactions?${params.toString()}`);
  return { transactions: data.transactions || [], nextCursor: data.next_cursor || null, hasMore: !!data.has_more };
}

export async function addTransaction({ householdId, userId, date, type, category, amount, note, wallet_id }) {
  const data = await apiFetch('/transactions', {
    method: 'POST',
    body: JSON.stringify({ date, type, category, amount, note, wallet_id }),
  });
  return data.transaction;
}

export async function deleteTransaction(id) {
  await apiFetch(`/transactions/${id}`, { method: 'DELETE' });
}

// Export CSV bukan lewat apiFetch karena responsnya file, bukan JSON —
// fetch manual supaya tetap bisa kirim header Authorization (bukan link biasa).
export async function exportMonthCSV(monthKey) {
  const token = getToken();
  const res = await fetch(`/api/transactions/export?month=${monthKey}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Gagal export data');
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transaksi-${monthKey}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Fetch manual (bukan apiFetch) + trigger download blob — dipakai
// exportTransactionsCsv & downloadBackup, sama pola dengan exportMonthCSV.
async function fetchAndDownload(path, fallbackFilename) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Gagal mengunduh file');
  }

  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match ? match[1] : fallbackFilename;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Export CSV riwayat transaksi memakai filter yang sedang aktif di HistoryPage.
export async function exportTransactionsCsv(filters = {}) {
  const params = new URLSearchParams({ format: 'csv' });
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, v);
  });
  await fetchAndDownload(`/transactions/export?${params.toString()}`, 'transaksi.csv');
}

// Cadangan JSON penuh household — tidak terpengaruh filter apapun.
export async function downloadBackup() {
  await fetchAndDownload('/households/me/backup', 'cadangan-keuangan.json');
}

// PDF di-generate di frontend (bukan backend, hindari dependency berat kayak
// puppeteer di server VPS), dan jsPDF di-load lazy (dynamic import) supaya
// tidak menambah bobot bundle awal — baru diunduh saat tombol Export PDF ditekan.
export async function exportMonthPDF(householdId, monthKey) {
  const [{ default: jsPDF }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable')
  ]);

  const transactions = await getMonthTransactions(householdId, monthKey);
  const { income, expense } = summarize(transactions);

  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(`Laporan Transaksi — ${monthKey}`, 14, 16);
  doc.setFontSize(10);
  doc.text(`Pemasukan: Rp ${income.toLocaleString('id-ID')}`, 14, 24);
  doc.text(`Pengeluaran: Rp ${expense.toLocaleString('id-ID')}`, 14, 30);
  doc.text(`Saldo: Rp ${(income - expense).toLocaleString('id-ID')}`, 14, 36);

  doc.autoTable({
    startY: 42,
    head: [['Tanggal', 'Tipe', 'Kategori', 'Nominal', 'Catatan', 'Dicatat Oleh']],
    body: transactions.map(t => [
      t.date,
      t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      t.category,
      'Rp ' + Number(t.amount).toLocaleString('id-ID'),
      t.note || '',
      t.creator_name || t.creator_email || ''
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 31, 61] }
  });

  doc.save(`transaksi-${monthKey}.pdf`);
}

export async function getContributions(monthKey) {
  const data = await apiFetch(`/transactions/contributions?month=${monthKey}`);
  return data.contributions || [];
}

export async function getZakatSummary() {
  return apiFetch('/transactions/zakat-summary');
}

export function summarize(transactions) {
  const income = transactions.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  return { income, expense };
}

export function groupExpenseByCategory(transactions) {
  const byCat = {};
  transactions.filter(t => t.type === "expense").forEach(t => {
    byCat[t.category] = (byCat[t.category] || 0) + Number(t.amount);
  });
  return byCat;
}

// Agregasi transaksi satu bulan (dari getMonthTransactions) jadi per-hari,
// untuk grafik "Analisis Harian" — dari tanggal 1 s.d. hari ini (kalau bulan
// berjalan) atau s.d. akhir bulan (kalau bulan lampau). Saldo = kumulatif
// masuk dikurangi keluar per hari, bukan saldo dompet sesungguhnya.
export function groupByDay(transactions, monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const lastDay = isCurrentMonth ? today.getDate() : daysInMonth;

  const masuk = Array(lastDay).fill(0);
  const keluar = Array(lastDay).fill(0);

  transactions.forEach((t) => {
    const day = Number(t.date.slice(8, 10));
    if (day < 1 || day > lastDay) return;
    if (t.type === 'income') masuk[day - 1] += Number(t.amount);
    else keluar[day - 1] += Number(t.amount);
  });

  let cumulative = 0;
  const saldo = masuk.map((m, i) => (cumulative += m - keluar[i]));

  const labels = Array.from({ length: lastDay }, (_, i) => String(i + 1).padStart(2, '0'));
  return { labels, masuk, keluar, saldo };
}

export async function getMonthlySummary(year) {
  const data = await apiFetch(`/transactions/monthly-summary?year=${year}`);
  return data.months || [];
}
