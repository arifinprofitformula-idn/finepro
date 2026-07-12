import { useState } from "react";
import { LockKeyhole, LogIn, ShieldCheck } from "lucide-react";
import { adminLogin } from "../api/admin.js";

const inputClass = "h-11 w-full rounded-xl border border-neutral-border bg-white/80 px-3 text-sm font-medium text-navy outline-none";

export default function AdminLoginPage({ onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const admin = await adminLogin(email.trim(), password);
      onLoggedIn(admin);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-glow-bg min-h-screen px-5 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-sm flex-col justify-center">
        <div className="mb-6">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet text-white shadow-soft">
            <ShieldCheck size={23} />
          </div>
          <div className="text-xs font-semibold uppercase tracking-wide text-violet">Finepro Admin</div>
          <h1 className="mt-1 text-2xl font-semibold text-navy">Masuk Admin Console</h1>
          <p className="mt-1 text-sm text-neutral-500">Gunakan akun admin atau superadmin untuk mengatur sistem.</p>
        </div>

        <form onSubmit={handleSubmit} className="gloss-panel rounded-2xl p-4">
          {message && (
            <div className="mb-3 rounded-xl bg-coral/10 px-3 py-2 text-sm font-medium text-coral">
              {message}
            </div>
          )}
          <label className="mb-1 block text-xs font-medium text-neutral-500">Email Admin</label>
          <input
            className={inputClass}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="owner@finepro.my.id"
          />

          <label className="mb-1 mt-3 block text-xs font-medium text-neutral-500">Password</label>
          <input
            className={inputClass}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password admin"
          />

          <button
            type="submit"
            disabled={loading}
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-violet px-4 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
          >
            {loading ? <LockKeyhole size={16} className="animate-pulse" /> : <LogIn size={16} />}
            {loading ? "Memverifikasi..." : "Masuk Admin"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { window.location.href = "/"; }}
          className="mt-4 text-center text-sm font-medium text-neutral-500"
        >
          Kembali ke aplikasi
        </button>
      </div>
    </div>
  );
}
