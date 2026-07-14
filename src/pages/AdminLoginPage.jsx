import { useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { adminLogin } from "../api/admin.js";

const inputClass =
  "h-12 w-full rounded-2xl border border-neutral-border bg-white px-3 text-sm font-semibold text-navy shadow-[inset_0_1px_2px_rgba(15,31,61,0.06)] outline-none transition placeholder:text-neutral-400 focus:border-violet focus:shadow-[0_0_0_4px_rgba(111,85,242,0.12),inset_0_1px_2px_rgba(15,31,61,0.04)]";

export default function AdminLoginPage({ onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="app-glow-bg font-admin min-h-screen px-5 py-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="gloss-panel rounded-[30px] p-5 sm:p-6">
          <div className="relative z-10">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <img
                  src="/images/fine-pro-header.jpg"
                  alt="FinePro"
                  className="h-10 w-auto max-w-[190px] rounded-xl object-contain sm:h-11"
                />
                <div className="text-[11px] font-semibold text-neutral-500">Admin Console</div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-light text-violet">
                <ShieldCheck size={18} />
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-full bg-mint-light px-3 py-1 text-[11px] font-semibold text-mint">
              <ShieldCheck size={13} />
              Akses terbatas
            </div>
            <h1 className="mt-3 text-2xl font-semibold leading-tight text-navy sm:text-3xl">
              Masuk ke ruang kendali Finepro.
            </h1>
            <p className="mt-2 text-sm font-medium leading-relaxed text-neutral-500">
              Pantau integrasi, pengguna, pembayaran, dan aktivitas sistem dengan tampilan yang lebih tenang.
            </p>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {[
                ["Integrasi", "Mail & AI"],
                ["Payments", "Midtrans"],
                ["Audit", "Log admin"]
              ].map(([title, value]) => (
                <div key={title} className="rounded-2xl border border-neutral-border/70 bg-white/60 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{title}</div>
                  <div className="mt-1 text-sm font-semibold text-navy">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="gloss-panel rounded-[30px] p-5 sm:p-6" noValidate>
          <div className="relative z-10">
            <div className="mb-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-violet">Login Admin</div>
              <h2 className="mt-1 text-xl font-semibold text-navy">Verifikasi akun</h2>
            </div>

            {message && (
              <div className="mb-3 rounded-2xl bg-coral-light px-3 py-2 text-sm font-semibold text-coral">
                {message}
              </div>
            )}

            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Email Admin</label>
            <input
              className={inputClass}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@finepro.my.id"
            />

            <label className="mb-1.5 mt-3 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Password</label>
            <div className="relative">
              <input
                className={`${inputClass} pr-12`}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password admin"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-neutral-500 transition hover:bg-violet-light hover:text-violet"
                aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
                title={showPassword ? "Sembunyikan password" : "Lihat password"}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-navy px-4 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(15,31,61,0.26)] transition active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? <LockKeyhole size={16} className="animate-pulse" /> : <ArrowRight size={16} />}
              {loading ? "Memverifikasi..." : "Masuk Admin"}
            </button>

            <button
              type="button"
              onClick={() => { window.location.href = "/"; }}
              className="mt-4 w-full text-center text-sm font-semibold text-neutral-500 transition hover:text-violet"
            >
              Kembali ke aplikasi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
