// src/api/whatsapp.js
// Hubungkan akun finepro ke WhatsApp — dipakai SettingPage untuk minta kode
// link sekali pakai yang lalu dikirim user ke nomor WhatsApp bisnis.

import { apiFetch } from "./apiClient.js";

export async function startWhatsAppLink() {
  return apiFetch("/whatsapp/link/start", { method: "POST" });
}

export async function disconnectWhatsAppLink() {
  return apiFetch("/whatsapp/link", { method: "DELETE" });
}
