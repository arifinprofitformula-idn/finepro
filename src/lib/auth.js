// src/lib/auth.js
// Autentikasi via API lokal (Express.js + JWT), menggantikan Supabase Auth.

import { apiFetch, setToken, getToken } from "./apiClient.js";

export async function signUp(email, password) {
  const data = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  return data;
}

export async function signIn(email, password) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  return data;
}

export async function signOut() {
  setToken(null);
}

export async function getCurrentUser() {
  const token = getToken();
  if (!token) return null;
  try {
    const data = await apiFetch('/auth/me');
    return data.user;
  } catch {
    return null;
  }
}

export async function getSession() {
  const user = await getCurrentUser();
  return user ? { user } : null;
}

// FormData, bukan JSON, jadi tidak lewat apiFetch — browser yang set Content-Type
// (multipart boundary) sendiri, jangan di-override manual.
export async function uploadAvatar(file) {
  const token = getToken();
  const formData = new FormData();
  formData.append('avatar', file);

  const res = await fetch('/api/auth/avatar', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gagal mengunggah foto');
  }
  return data.user;
}

export function translateAuthError(msg) {
  if (!msg) return "Terjadi kesalahan. Coba lagi.";
  if (msg.includes("Email atau password salah")) return "Email atau kata sandi salah.";
  if (msg.includes("sudah terdaftar")) return "Email sudah terdaftar. Coba menu Masuk.";
  if (msg.includes("minimal 6 karakter")) return "Kata sandi minimal 6 karakter.";
  return msg;
}
