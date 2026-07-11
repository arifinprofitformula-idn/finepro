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
