// src/lib/auth.js
// Logika autentikasi: login, signup, logout, cek sesi aktif.

import { supabase } from "./supabaseClient.js";

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data; // data.session null jika project mewajibkan konfirmasi email
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export function translateAuthError(msg) {
  if (!msg) return "Terjadi kesalahan. Coba lagi.";
  if (msg.includes("Invalid login credentials")) return "Email atau kata sandi salah.";
  if (msg.includes("already registered")) return "Email sudah terdaftar. Coba menu Masuk.";
  if (msg.includes("Password should be")) return "Kata sandi minimal 6 karakter.";
  return msg;
}
