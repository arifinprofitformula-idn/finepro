// src/pages/AuthPage.jsx
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth.js";
import { translateAuthError, forgotPassword, resetPassword } from "../api/auth.js";
import {
  ArrowRight,
  BarChart3,
  Eye,
  EyeOff,
  Gift,
  Inbox,
  LockKeyhole,
  Mail,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UserRound,
  WalletCards
} from "lucide-react";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isValidEmail(value) {
  return EMAIL_PATTERN.test(String(value || "").trim());
}

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
        shape: "pill",
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

function BrandMark() {
  return (
    <div className="flex min-w-0 items-center">
      <img
        src="/images/fine-pro-header.jpg"
        alt="FinePro"
        className="h-10 w-auto max-w-[180px] rounded-xl object-contain sm:h-11"
      />
    </div>
  );
}

function ModeTabs({ mode, switchMode }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-full bg-neutral-100 p-1">
      <button
        type="button"
        className={`min-h-[40px] rounded-full text-sm font-semibold transition-all duration-300 ${
          mode === "login" ? "bg-mint text-white shadow-[0_10px_22px_rgba(24,197,148,0.24)]" : "text-neutral-500"
        }`}
        onClick={() => switchMode("login")}
      >
        Masuk
      </button>
      <button
        type="button"
        className={`min-h-[40px] rounded-full text-sm font-semibold transition-all duration-300 ${
          mode === "signup" ? "bg-violet text-white shadow-[0_10px_22px_rgba(111,85,242,0.26)]" : "text-neutral-500"
        }`}
        onClick={() => switchMode("signup")}
      >
        Daftar
      </button>
    </div>
  );
}

function InputShell({ icon: Icon, label, children }) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-navy">
        <Icon size={14} />
        {label}
      </label>
      {children}
    </div>
  );
}

function StatusMessage({ msg, type }) {
  if (!msg) return null;
  return (
    <div
      className={`rounded-2xl px-3 py-2 text-xs font-semibold ${
        type === "error" ? "bg-coral-light text-coral" : "bg-mint-light text-mint"
      }`}
    >
      {msg}
    </div>
  );
}

function LoginPreview() {
  return (
    <div className="mt-5 rounded-2xl border border-white/70 bg-white/45 p-3 animate-auth-fade-up">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-semibold text-neutral-500">Ringkasan hari ini</div>
        <div className="rounded-full bg-mint-light px-2 py-1 text-[10px] font-bold text-mint">Aktif</div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Masuk", value: "3,2jt", tone: "text-mint" },
          { label: "Keluar", value: "1,4jt", tone: "text-coral" },
          { label: "Saldo", value: "1,8jt", tone: "text-violet" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl bg-white/65 p-2">
            <div className="text-[10px] font-medium text-neutral-500">{item.label}</div>
            <div className={`mt-1 text-xs font-bold ${item.tone}`}>{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SignupBenefits() {
  const items = [
    { icon: ReceiptText, title: "Transaksi rapi", text: "Catatan harian langsung terbaca." },
    { icon: WalletCards, title: "Budget terarah", text: "Pantau batas tiap pos." },
    { icon: BarChart3, title: "Insight ringan", text: "Lihat pola tanpa ribet." },
  ];

  return (
    <div className="grid gap-2">
      {items.map(({ icon: Icon, title, text }, index) => (
        <div
          key={title}
          className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/45 p-3 animate-auth-fade-up"
          style={{ animationDelay: `${index * 80}ms` }}
        >
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-violet-light text-violet">
            <Icon size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-navy">{title}</div>
            <div className="text-xs font-medium text-neutral-500">{text}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AuthPage({ onBack, initialMode } = {}) {
  const { login, signup, loginWithGoogle, verifyEmailToken, resendVerificationEmail } = useAuth();
  const [mode, setMode] = useState(initialMode === "signup" ? "signup" : "login"); // login | signup | forgot | reset | verify
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("");
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [signupSubmitted, setSignupSubmitted] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState("pending"); // pending | success | error
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendStatus, setResendStatus] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resetTokenParam = params.get("reset_token");
    const verifyTokenParam = params.get("verify_token");
    if (resetTokenParam) {
      setResetToken(resetTokenParam);
      setMode("reset");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (verifyTokenParam) {
      setMode("verify");
      window.history.replaceState({}, "", window.location.pathname);
      verifyEmailToken(verifyTokenParam)
        .then(() => setVerifyStatus("success"))
        .catch(() => setVerifyStatus("error"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function switchMode(next) {
    setMode(next);
    setMsg("");
    setMsgType("");
    setPassword("");
    setShowPassword(false);
    setNeedsVerification(false);
    setResendStatus("");
    if (next !== "forgot") setForgotSubmitted(false);
    if (next !== "signup") setSignupSubmitted(false);
  }

  async function handleResendVerification() {
    setLoading(true);
    setResendStatus("");
    try {
      await resendVerificationEmail(email.trim());
      setResendStatus("Tautan verifikasi baru sudah dikirim. Cek inbox dan folder spam.");
    } catch (err) {
      setResendStatus(err.message || "Gagal mengirim ulang tautan verifikasi.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("");
    setMsgType("");

    const trimmedEmail = email.trim();
    const trimmedName = name.trim();

    if ((mode === "login" || mode === "signup" || mode === "forgot") && !trimmedEmail) {
      setMsg("Email wajib diisi.");
      setMsgType("error");
      setForgotSubmitted(false);
      return;
    }

    if ((mode === "login" || mode === "signup" || mode === "forgot") && !isValidEmail(trimmedEmail)) {
      setMsg("Format email belum benar. Gunakan format seperti nama@email.com.");
      setMsgType("error");
      setForgotSubmitted(false);
      return;
    }

    if (mode === "signup" && !trimmedName) {
      setMsg("Nama pengguna wajib diisi.");
      setMsgType("error");
      return;
    }

    if ((mode === "login" || mode === "signup" || mode === "reset") && password.length < 6) {
      setMsg(mode === "reset" ? "Password baru minimal 6 karakter." : "Kata sandi minimal 6 karakter.");
      setMsgType("error");
      return;
    }

    setLoading(true);
    setNeedsVerification(false);
    setResendStatus("");
    try {
      if (mode === "signup") {
        await signup(trimmedEmail, password, trimmedName);
        setEmail(trimmedEmail);
        setMsg("");
        setMsgType("");
        setSignupSubmitted(true);
      } else if (mode === "forgot") {
        await forgotPassword(trimmedEmail);
        setEmail(trimmedEmail);
        setMsg("");
        setMsgType("");
        setForgotSubmitted(true);
      } else if (mode === "reset") {
        const data = await resetPassword(resetToken, password);
        setMsg(data.message);
        setMsgType("success");
        setTimeout(() => switchMode("login"), 1500);
      } else {
        await login(trimmedEmail, password);
      }
    } catch (err) {
      setMsg(translateAuthError(err.message));
      setMsgType("error");
      if (err.code === "EMAIL_NOT_VERIFIED") {
        setNeedsVerification(true);
      }
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
  const isSignup = mode === "signup";
  const isUtilityMode = mode === "forgot" || mode === "reset" || mode === "verify";
  const showCheckEmailPanel = (mode === "forgot" && forgotSubmitted) || (mode === "signup" && signupSubmitted);
  const inputClass =
    "w-full rounded-2xl border border-neutral-border bg-white px-3 py-3 text-sm font-semibold text-navy shadow-[inset_0_1px_2px_rgba(15,31,61,0.06)] outline-none transition placeholder:text-neutral-400 focus:border-violet focus:bg-white focus:shadow-[0_0_0_4px_rgba(111,85,242,0.12),inset_0_1px_2px_rgba(15,31,61,0.04)]";

  return (
    <div className="app-glow-bg min-h-screen px-5 py-7">
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-lg flex-col justify-center">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-3 flex w-fit items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-violet"
          >
            <ArrowRight size={13} className="rotate-180" />
            Kembali ke beranda
          </button>
        )}
        <div className={`grid gap-4 transition-all duration-500 ${isSignup ? "md:gap-5" : ""}`}>
          <div className={`gloss-panel rounded-[28px] p-4 ${isSignup ? "animate-auth-fade-up" : "animate-auth-float"}`}>
            <div className="flex items-start justify-between gap-3">
              <BrandMark />
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-mint-light text-mint">
                <ShieldCheck size={17} />
              </div>
            </div>

            {!isUtilityMode && (
              <div className="mt-5">
                <ModeTabs mode={mode} switchMode={switchMode} />
              </div>
            )}

            {mode === "login" && (
              <div className="mt-5 animate-auth-fade-up">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-light px-3 py-1 text-[11px] font-bold text-violet">
                  <Sparkles size={13} />
                  Selamat datang kembali
                </div>
                <h1 className="mt-3 text-2xl font-bold leading-tight text-navy">Masuk dan lanjutkan catatanmu.</h1>
                <p className="mt-2 text-sm font-medium leading-relaxed text-neutral-500">
                  Dashboard, budget, tagihan, dan transaksi terakhir siap dilanjutkan dari satu tempat.
                </p>
                <LoginPreview />
              </div>
            )}

            {mode === "signup" && (
              <div className="mt-5 animate-auth-fade-up">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-gold-light/70 px-3 py-1 text-[11px] font-bold text-gold">
                  <Gift size={13} />
                  14 Hari Gratis · Tanpa Kartu Kredit
                </div>
                <h1 className="mt-3 text-2xl font-bold leading-tight text-navy">Buat Akun, Nikmati 14 Hari Gratis Mulai Hari Ini</h1>
                <p className="mt-2 text-sm font-medium leading-relaxed text-neutral-500">
                  Setelah ini, kamu nggak perlu lagi menebak-nebak ke mana uangmu pergi.
                </p>
                <div className="mt-4">
                  <SignupBenefits />
                </div>
              </div>
            )}

            {mode === "forgot" && (
              <div className="mt-5 animate-auth-fade-up">
                <h1 className="text-2xl font-bold leading-tight text-navy">Lupa password?</h1>
                <p className="mt-2 text-sm font-medium leading-relaxed text-neutral-500">
                  Masukkan email yang dipakai saat mendaftar. Demi keamanan, kami tidak menampilkan apakah email
                  tersebut terdaftar atau tidak.
                </p>
                <div className="mt-4 grid gap-2 rounded-2xl border border-white/70 bg-white/45 p-3 text-xs font-semibold text-neutral-500">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-violet-light text-[10px] font-bold text-violet">1</span>
                    Isi email akunmu.
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-violet-light text-[10px] font-bold text-violet">2</span>
                    Jika email terdaftar, tautan reset dikirim dan berlaku 1 jam.
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-violet-light text-[10px] font-bold text-violet">3</span>
                    Cek inbox/spam. Jika akun dibuat via Google, masuk dengan tombol Google.
                  </div>
                </div>
              </div>
            )}

            {mode === "reset" && (
              <div className="mt-5 animate-auth-fade-up">
                <h1 className="text-2xl font-bold leading-tight text-navy">Buat password baru.</h1>
                <p className="mt-2 text-sm font-medium leading-relaxed text-neutral-500">
                  Masukkan password baru minimal 6 karakter. Link reset berlaku 1 jam; jika ditolak atau kedaluwarsa,
                  ulangi dari menu Lupa Password.
                </p>
              </div>
            )}

            {mode === "verify" && (
              <div className="mt-5 animate-auth-fade-up">
                <h1 className="text-2xl font-bold leading-tight text-navy">Verifikasi email.</h1>
                <p className="mt-2 text-sm font-medium leading-relaxed text-neutral-500">
                  {verifyStatus === "pending" && "Sedang memverifikasi email kamu..."}
                  {verifyStatus === "success" && "Email berhasil diverifikasi. Kamu sudah masuk."}
                  {verifyStatus === "error" && "Tautan verifikasi tidak valid atau sudah kedaluwarsa."}
                </p>
              </div>
            )}
          </div>

          <div key={mode} className="gloss-panel rounded-[28px] p-4 animate-auth-slide-up">
            {!showCheckEmailPanel && mode !== "verify" && (
              <div className="mb-3 rounded-2xl border border-neutral-border/70 bg-white/60 px-3 py-2 text-xs font-semibold text-neutral-500">
                {mode === "forgot" ? "Kami akan memproses permintaan tanpa membocorkan status email." : "Isi data akun pada kolom di bawah."}
              </div>
            )}
            {mode === "forgot" && forgotSubmitted && (
              <div className="mb-3 rounded-2xl border border-mint/25 bg-mint-light px-3 py-3 text-xs font-semibold text-neutral-700">
                <div className="mb-2 flex items-center gap-2 text-mint">
                  <Inbox size={15} />
                  Cek email kamu
                </div>
                <p className="leading-relaxed">
                  Jika email <span className="font-bold text-navy">{email || "yang dimasukkan"}</span> terdaftar,
                  tautan reset sudah dikirim. Cek inbox dan spam. Tidak ada email masuk? Pastikan emailnya benar,
                  tunggu sebentar, lalu kirim ulang.
                </p>
              </div>
            )}
            {mode === "signup" && signupSubmitted && (
              <div className="mb-3 rounded-2xl border border-mint/25 bg-mint-light px-3 py-3 text-xs font-semibold text-neutral-700">
                <div className="mb-2 flex items-center gap-2 text-mint">
                  <Inbox size={15} />
                  Cek email kamu
                </div>
                <p className="leading-relaxed">
                  Tautan verifikasi sudah dikirim ke <span className="font-bold text-navy">{email}</span>. Klik
                  tautan tersebut untuk mengaktifkan akun. Cek inbox dan folder spam.
                </p>
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={loading}
                  className="mt-3 w-full rounded-full bg-mint px-3 py-2 text-xs font-bold text-white transition active:scale-[0.98] disabled:opacity-60"
                >
                  {loading ? "Mengirim..." : "Kirim Ulang Tautan"}
                </button>
                {resendStatus && (
                  <p className="mt-2 leading-relaxed text-neutral-700">{resendStatus}</p>
                )}
              </div>
            )}
            {mode === "verify" && (
              <div
                className={`mb-3 rounded-2xl border px-3 py-3 text-xs font-semibold leading-relaxed ${
                  verifyStatus === "error"
                    ? "border-coral/20 bg-coral-light text-coral"
                    : "border-mint/25 bg-mint-light text-neutral-700"
                }`}
              >
                {verifyStatus === "pending" && "Mohon tunggu sebentar..."}
                {verifyStatus === "success" && "Email berhasil diverifikasi dan kamu sudah masuk ke akun."}
                {verifyStatus === "error" && "Tautan sudah tidak berlaku. Masuk lalu minta kirim ulang tautan verifikasi."}
                {verifyStatus === "error" && (
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="mt-3 block w-full rounded-full bg-navy px-3 py-2 text-center text-xs font-bold text-white transition active:scale-[0.98]"
                  >
                    Kembali ke halaman Masuk
                  </button>
                )}
              </div>
            )}
            {!showCheckEmailPanel && mode !== "verify" && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
              {mode === "signup" && (
                <InputShell icon={UserRound} label="Nama Pengguna">
                  <input
                    id="auth-name"
                    type="text"
                    required
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nama yang tampil di aplikasi"
                    className={inputClass}
                  />
                </InputShell>
              )}

              {(mode === "login" || mode === "signup" || mode === "forgot") && (
                <InputShell icon={Mail} label="Email">
                  <input
                    id="auth-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (mode === "forgot") setForgotSubmitted(false);
                    }}
                    placeholder="nama@email.com"
                    className={inputClass}
                  />
                </InputShell>
              )}

              {(isPasswordMode || mode === "reset") && (
                <InputShell icon={LockKeyhole} label={mode === "reset" ? "Password Baru" : "Kata Sandi"}>
                  <div className="relative">
                    <input
                      id="auth-password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className={`${inputClass} pr-12`}
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
                </InputShell>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`mt-1 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full text-sm font-bold text-white shadow-float transition active:scale-[0.98] disabled:opacity-60 ${
                  isSignup
                    ? "bg-violet shadow-[0_18px_34px_rgba(111,85,242,0.32)]"
                    : "bg-navy shadow-[0_18px_34px_rgba(15,31,61,0.26)]"
                }`}
              >
                {loading ? "Memproses..." : null}
                {!loading && mode === "signup" && "Daftar"}
                {!loading && mode === "login" && "Masuk"}
                {!loading && mode === "forgot" && (forgotSubmitted ? "Kirim Ulang Tautan" : "Kirim Tautan Reset")}
                {!loading && mode === "reset" && "Simpan Password Baru"}
                {!loading && <ArrowRight size={16} />}
              </button>

              <StatusMessage msg={mode === "forgot" && msgType === "success" ? "" : msg} type={msgType} />

              {mode === "login" && needsVerification && (
                <div className="rounded-2xl border border-coral/20 bg-coral-light/60 px-3 py-2 text-xs font-semibold text-coral">
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={loading}
                    className="underline decoration-dotted underline-offset-2 disabled:opacity-60"
                  >
                    Kirim ulang tautan verifikasi
                  </button>
                  {resendStatus && <p className="mt-1.5 font-medium text-neutral-700">{resendStatus}</p>}
                </div>
              )}
            </form>
            )}

            {mode === "login" && (
              <button
                type="button"
                onClick={() => switchMode("forgot")}
                className="mt-3 w-full text-center text-xs font-semibold text-neutral-500 transition hover:text-violet"
              >
                Lupa password?
              </button>
            )}

            {(mode === "forgot" || mode === "reset") && (
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="mt-3 w-full text-center text-xs font-semibold text-neutral-500 transition hover:text-violet"
              >
                Kembali ke halaman Masuk
              </button>
            )}

            {isPasswordMode && !showCheckEmailPanel && (
              <>
                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-neutral-border" />
                  <span className="text-[11px] font-semibold text-neutral-400">atau</span>
                  <div className="h-px flex-1 bg-neutral-border" />
                </div>
                <GoogleSignInButton onCredential={handleGoogleCredential} />
              </>
            )}

            {mode === "login" && (
              <p className="mt-4 text-center text-[11px] font-medium text-neutral-500">
                Akun baru otomatis mendapat masa coba 14 hari gratis.
              </p>
            )}
            {mode === "signup" && (
              <p className="mt-4 text-center text-[11px] font-medium leading-relaxed text-neutral-500">
                Dengan mendaftar, kamu menyetujui{" "}
                <a href="/privacy" className="font-bold text-violet hover:underline">
                  Kebijakan Privasi Fine Pro
                </a>
                .
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
