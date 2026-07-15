// src/lib/auth.js
// Autentikasi via API lokal (Express.js + JWT), menggantikan Supabase Auth.

import { API_BASE, apiFetch, setToken, getToken } from "./apiClient.js";

// Registrasi tidak lagi auto-login — akun baru wajib verifikasi email dulu
// (lihat verifyEmail di bawah), jadi respons di sini hanya berisi pesan info.
export async function signUp(email, password, name) {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
}

export async function verifyEmail(token) {
  const data = await apiFetch('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
  setToken(data.token);
  return data;
}

export async function resendVerification(email) {
  return apiFetch('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function signIn(email, password) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  return data;
}

export async function signInWithGoogle(idToken) {
  const data = await apiFetch('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });
  setToken(data.token);
  return data;
}

export async function signOut() {
  setToken(null);
}

export async function forgotPassword(email) {
  return apiFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token, password) {
  return apiFetch('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}

export async function changePassword(oldPassword, newPassword) {
  return apiFetch('/auth/change-password', {
    method: 'PUT',
    body: JSON.stringify({ oldPassword, newPassword }),
  });
}

export async function updateProfile({ name }) {
  const data = await apiFetch('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
  return data.user;
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

  const res = await fetch(`${API_BASE}/auth/avatar`, {
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
