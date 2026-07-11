// src/utils/format.js

export function fmtRp(n) {
  const sign = n < 0 ? "-" : "";
  return sign + "Rp " + Math.abs(Math.round(n)).toLocaleString("id-ID");
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function monthKey(dateStr) {
  return dateStr.slice(0, 7);
}

// Hitung selisih hari ke tanggal "uang bulanan" terdekat (1-31), dengan
// kalender aman untuk bulan pendek (mis. tanggal 31 di bulan Februari).
export function daysUntilMonthlyDay(day) {
  if (!day) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastDayOf = (y, m) => new Date(y, m + 1, 0).getDate();

  let y = today.getFullYear();
  let m = today.getMonth();
  let target = new Date(y, m, Math.min(day, lastDayOf(y, m)));

  if (target < today) {
    m += 1;
    if (m > 11) { m = 0; y += 1; }
    target = new Date(y, m, Math.min(day, lastDayOf(y, m)));
  }

  return Math.round((target - today) / 86400000);
}
