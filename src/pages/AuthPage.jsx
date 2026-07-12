// src/pages/AuthPage.jsx
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth.js";
import { translateAuthError, forgotPassword, resetPassword } from "../api/auth.js";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function GoogleSignInButton({ onCredential }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    let cancelled = false;

    function render() {
      if (cancelled || !window.google?.accounts?.id || !containerRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => onCredential(response.credential),
      });
      window.google.accounts.id.renderButton(containerRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        width: 320,
        text: "continue_with",
      });
    }

    if (window.google?.accounts?.id) {
      render();
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          render();
        }
      }, 200);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }

    return () => { cancelled = true; };
  }, [onCredential]);

  if (!GOOGLE_CLIENT_ID) return null;

  return <div ref={containerRef} className="flex justify-center" />;
}

export default function AuthPage() {
  const { login, signup, loginWithGoogle } = useAuth();
  const [mode, setMode] = useState("login"); // login | signup | forgot | reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("reset_token");
    if (token) {
      setResetToken(token);
      setMode("reset");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  function switchMode(next) {
    setMode(next);
    setMsg("");
    setPassword("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      if (mode === "signup") {
        await signup(email, password);
      } else if (mode === "forgot") {
        const data = await forgotPassword(email);
        setMsg(data.message);
        setMsgType("success");
      } else if (mode === "reset") {
        const data = await resetPassword(resetToken, password);
        setMsg(data.message);
        setMsgType("success");
        setTimeout(() => switchMode("login"), 1500);
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

  async function handleGoogleCredential(idToken) {
    setLoading(true);
    setMsg("");
    try {
      await loginWithGoogle(idToken);
    } catch (err) {
      setMsg(translateAuthError(err.message));
      setMsgType("error");
    } finally {
      setLoading(false);
    }
  }

  const isPasswordMode = mode === "login" || mode === "signup";

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-bg px-6">
      <div className="w-full max-w-sm rounded-2xl bg-white border border-neutral-border p-6 shadow-sm">
        <div className="w-12 h-12 rounded-xl bg-navy text-white flex items-center justify-center font-bold text-lg mb-4">
          KK
        </div>
        <h1 className="text-lg font-bold text-neutral-900 mb-1">Keuangan Keluarga</h1>
        <p className="text-sm text-neutral-500 mb-5">Untuk keluarga, pasangan, maupun mahasiswa.</p>

        {(mode === "login" || mode === "signup") && (
          <div className="flex gap-1.5 mb-4 bg-neutral-100 rounded-lg p-1">
            <button
              type="button"
              className={`flex-1 text-center min-h-[40px] rounded-md text-sm font-semibold transition-colors ${
                mode === "login" ? "bg-white text-navy shadow-sm" : "text-neutral-500"
              }`}
              onClick={() => switchMode("login")}
            >
              Masuk
            </button>
            <button
              type="button"
              className={`flex-1 text-center min-h-[40px] rounded-md text-sm font-semibold transition-colors ${
                mode === "signup" ? "bg-white text-navy shadow-sm" : "text-neutral-500"
              }`}
              onClick={() => switchMode("signup")}
            >
              Daftar
            </button>
          </div>
        )}

        {mode === "forgot" && (
          <div className="mb-4">
            <h2 className="text-sm font-bold text-neutral-900">Lupa Password</h2>
            <p className="text-xs text-neutral-500 mt-0.5">Masukkan email, kami kirim tautan reset password.</p>
          </div>
        )}

        {mode === "reset" && (
          <div className="mb-4">
            <h2 className="text-sm font-bold text-neutral-900">Buat Password Baru</h2>
            <p className="text-xs text-neutral-500 mt-0.5">Masukkan password baru untuk akun Anda.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {(mode === "login" || mode === "signup" || mode === "forgot") && (
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
          )}
          {(isPasswordMode || mode === "reset") && (
            <div>
              <label htmlFor="auth-password" className="block text-xs text-neutral-500 mb-1">
                {mode === "reset" ? "Password Baru" : "Kata Sandi"}
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
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] bg-navy text-white rounded-lg py-2.5 text-sm font-bold disabled:opacity-60 mt-1"
          >
            {mode === "signup" && "Daftar"}
            {mode === "login" && "Masuk"}
            {mode === "forgot" && "Kirim Tautan Reset"}
            {mode === "reset" && "Simpan Password Baru"}
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

        {mode === "login" && (
          <button
            type="button"
            onClick={() => switchMode("forgot")}
            className="w-full text-center text-xs text-neutral-500 mt-3 hover:text-navy"
          >
            Lupa password?
          </button>
        )}

        {(mode === "forgot" || mode === "reset") && (
          <button
            type="button"
            onClick={() => switchMode("login")}
            className="w-full text-center text-xs text-neutral-500 mt-3 hover:text-navy"
          >
            Kembali ke halaman Masuk
          </button>
        )}

        {isPasswordMode && (
          <>
            <div className="flex items-center gap-3 my-4">
              <div className="h-px flex-1 bg-neutral-border" />
              <span className="text-[11px] text-neutral-400">atau</span>
              <div className="h-px flex-1 bg-neutral-border" />
            </div>
            <GoogleSignInButton onCredential={handleGoogleCredential} />
          </>
        )}

        {mode === "login" && (
          <p className="text-[11px] text-neutral-500 text-center mt-4">
            Akun baru otomatis mendapat masa coba 14 hari gratis.
          </p>
        )}
      </div>
    </div>
  );
}
