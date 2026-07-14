// src/lib/apiClient.js
// API client pengganti Supabase — semua request ke Express.js backend via fetch.
// Token JWT disimpan di localStorage, otomatis disertakan di setiap request.

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

let _token = localStorage.getItem('keuangan_token');

export function setToken(token) {
  _token = token;
  if (token) localStorage.setItem('keuangan_token', token);
  else localStorage.removeItem('keuangan_token');
}

export function getToken() {
  return _token;
}

export async function apiFetch(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...options.headers,
  };

  if (_token) {
    headers['Authorization'] = `Bearer ${_token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  // Jika token expired, hapus token — React auth context akan redirect ke login
  if (res.status === 401 && _token) {
    setToken(null);
    throw new Error('Sesi berakhir. Silakan login kembali.');
  }

  const text = await res.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    throw new Error(data.error || 'Terjadi kesalahan');
  }

  return data;
}
