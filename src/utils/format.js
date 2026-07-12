// src/utils/format.js

export function fmtRp(n) {
  const sign = n < 0 ? "-" : "";
  return sign + "Rp " + Math.abs(Math.round(n)).toLocaleString("id-ID");
}

export function formatNumberIdInput(value) {
  const raw = String(value ?? "").replace(/[^\d,]/g, "");
  if (!raw) return "";

  const hasDecimal = raw.includes(",");
  const [integerRaw, ...decimalParts] = raw.split(",");
  const integer = integerRaw.replace(/^0+(?=\d)/, "");
  const formattedInteger = (integer || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decimal = decimalParts.join("");

  return hasDecimal ? `${formattedInteger},${decimal}` : formattedInteger;
}

export function parseNumberId(value) {
  const normalized = String(value ?? "").replace(/\./g, "").replace(",", ".");
  return parseFloat(normalized) || 0;
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function monthKey(dateStr) {
  return dateStr.slice(0, 7);
}

export function currentMonthKey() {
  return monthKey(todayStr());
}

export function monthKeyToParts(key) {
  const [year, month] = String(key || currentMonthKey()).split("-").map(Number);
  return {
    year: Number.isFinite(year) ? year : new Date().getFullYear(),
    month: Number.isFinite(month) ? month : new Date().getMonth() + 1,
  };
}

export function shiftMonthKey(key, delta) {
  const { year, month } = monthKeyToParts(key);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthRangeFromKey(key) {
  const { year, month } = monthKeyToParts(key);
  const lastDay = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  return {
    date_from: `${year}-${mm}-01`,
    date_to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function monthLabel(key, options = {}) {
  const { year, month } = monthKeyToParts(key);
  return new Intl.DateTimeFormat("id-ID", {
    month: options.short ? "short" : "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
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

// Selisih hari ke tanggal spesifik (YYYY-MM-DD), untuk pengingat tagihan.
// Beda dari daysUntilMonthlyDay: ini tanggal pasti, bukan tanggal berulang di bulan berjalan.
export function daysUntilDate(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.round((target - today) / 86400000);
}
