// src/api/telegram.js
// Hubungkan akun finepro ke Telegram — dipakai AccountPage untuk minta kode
// link sekali pakai yang lalu dikirim user sebagai "/start <code>" ke bot.

import { apiFetch } from "./apiClient.js";

export async function startTelegramLink() {
  return apiFetch("/telegram/link/start", { method: "POST" });
}
