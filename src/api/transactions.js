// src/lib/transactions.js
// CRUD transaksi via API lokal

import { apiFetch, getToken } from "./apiClient.js";

export async function getMonthTransactions(householdId, monthKey) {
  const [year, month] = monthKey.split('-');
  const data = await apiFetch(`/transactions?month=${month}&year=${year}`);
  return data.transactions || [];
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

// FormData, bukan JSON, jadi tidak lewat apiFetch — sama pola dengan uploadAvatar.
export async function scanReceipt(file) {
  const token = getToken();
  const formData = new FormData();
  formData.append('receipt', file);

  const res = await fetch('/api/transactions/scan-receipt', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gagal memindai struk');
  }
  return data;
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
