// src/pages/AuthPage.jsx
import { useState } from "react";
import { useAuth } from "../hooks/useAuth.js";
import { translateAuthError } from "../api/auth.js";

export default function AuthPage() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      if (mode === "signup") {
        await signup(email, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setMsg(translateAuthError(err.message));
      setMsgType("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-bg px-6">
      <div className="w-full max-w-sm rounded-2xl bg-white border border-neutral-border p-6 shadow-sm">
        <div className="w-12 h-12 rounded-xl bg-navy text-white flex items-center justify-center font-bold text-lg mb-4">
          KK
        </div>
        <h1 className="text-lg font-bold text-neutral-900 mb-1">Keuangan Keluarga</h1>
        <p className="text-sm text-neutral-500 mb-5">Untuk keluarga, pasangan, maupun mahasiswa.</p>

        <div className="flex gap-1.5 mb-4 bg-neutral-100 rounded-lg p-1">
          <button
            type="button"
            className={`flex-1 text-center min-h-[40px] rounded-md text-sm font-semibold transition-colors ${
              mode === "login" ? "bg-white text-navy shadow-sm" : "text-neutral-500"
            }`}
            onClick={() => setMode("login")}
          >
            Masuk
          </button>
          <button
            type="button"
            className={`flex-1 text-center min-h-[40px] rounded-md text-sm font-semibold transition-colors ${
              mode === "signup" ? "bg-white text-navy shadow-sm" : "text-neutral-500"
            }`}
            onClick={() => setMode("signup")}
          >
            Daftar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label htmlFor="auth-email" className="block text-xs text-neutral-500 mb-1">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-border bg-white text-neutral-900 focus:outline-none focus:ring-1 focus:ring-navy"
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="block text-xs text-neutral-500 mb-1">
              Kata Sandi
            </label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-border bg-white text-neutral-900 focus:outline-none focus:ring-1 focus:ring-navy"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] bg-navy text-white rounded-lg py-2.5 text-sm font-bold disabled:opacity-60 mt-1"
          >
            {mode === "signup" ? "Daftar" : "Masuk"}
          </button>
          {msg && (
            <div
              className={`text-xs rounded-md px-3 py-2 ${
                msgType === "error" ? "bg-danger/10 text-danger" : "bg-success/10 text-success"
              }`}
            >
              {msg}
            </div>
          )}
        </form>
        <p className="text-[11px] text-neutral-500 text-center mt-4">
          Akun baru otomatis mendapat masa coba 14 hari gratis.
        </p>
      </div>
    </div>
  );
}
