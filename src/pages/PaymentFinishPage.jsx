import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, Crown, Home, Loader2, ReceiptText, XCircle } from "lucide-react";
import { getPaymentStatus, PLANS } from "../api/payments.js";
import { fmtRp } from "../utils/format.js";

const MAX_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 3000;

function BrandLogo() {
  return (
    <img
      src="/images/fine-pro-header.png"
      alt="Fine Pro"
      className="h-12 w-auto object-contain"
    />
  );
}

function StatusIcon({ status, polling }) {
  if (polling) {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-violet-light text-violet shadow-soft">
        <Loader2 size={38} className="animate-spin" />
      </div>
    );
  }

  if (status === "paid") {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-mint-light text-mint shadow-soft">
        <CheckCircle2 size={42} />
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-coral-light text-coral shadow-soft">
        <XCircle size={42} />
      </div>
    );
  }

  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-gold-light text-gold shadow-soft">
      <Clock3 size={40} />
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/70 p-3">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-violet-light text-violet">
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase text-neutral-400">{label}</div>
        <div className="truncate text-sm font-bold text-navy">{value}</div>
      </div>
    </div>
  );
}

export default function PaymentFinishPage({ onPaid, onGoAccount, onGoDashboard }) {
  const orderId = useMemo(() => new URLSearchParams(window.location.search).get("order_id"), []);
  const [payment, setPayment] = useState(null);
  const [polling, setPolling] = useState(Boolean(orderId));
  const [message, setMessage] = useState(orderId ? "Memastikan pembayaran Anda..." : "Order pembayaran tidak ditemukan.");

  useEffect(() => {
    if (!orderId) return undefined;

    let cancelled = false;

    async function poll() {
      setPolling(true);
      for (let attempt = 0; attempt < MAX_ATTEMPTS && !cancelled; attempt += 1) {
        try {
          const nextPayment = await getPaymentStatus(orderId);
          if (cancelled) return;

          setPayment(nextPayment);
          if (nextPayment.status === "paid") {
            setMessage("Pembayaran berhasil. Paket Fine Pro Anda sudah aktif.");
            setPolling(false);
            await onPaid?.();
            return;
          }
          if (nextPayment.status === "failed") {
            setMessage("Pembayaran gagal atau dibatalkan.");
            setPolling(false);
            return;
          }
          setMessage("Pembayaran sedang diproses. Kami akan mengecek statusnya sebentar lagi.");
        } catch {
          if (!cancelled) setMessage("Kami masih mencoba membaca status pembayaran Anda.");
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }

      if (!cancelled) {
        setPolling(false);
        setMessage("Status pembayaran belum final. Silakan cek kembali dari halaman Akun beberapa saat lagi.");
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [orderId, onPaid]);

  const plan = PLANS.find((item) => item.id === payment?.plan);
  const isPaid = payment?.status === "paid";
  const isFailed = payment?.status === "failed";

  return (
    <div className="app-glow-bg min-h-screen px-5 py-8">
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg flex-col justify-center">
        <div className="mb-6 flex justify-center">
          <BrandLogo />
        </div>

        <section className="gloss-panel rounded-[32px] p-6 text-center">
          <div className="flex justify-center">
            <StatusIcon status={payment?.status} polling={polling} />
          </div>

          <div className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white/75 px-3 py-1 text-[11px] font-bold text-violet">
            <Crown size={13} />
            Fine Pro Subscription
          </div>

          <h1 className="mt-4 text-2xl font-bold leading-tight text-navy">
            {polling && "Menyelesaikan Pembayaran"}
            {!polling && isPaid && "Pembayaran Berhasil"}
            {!polling && isFailed && "Pembayaran Belum Berhasil"}
            {!polling && !isPaid && !isFailed && "Status Pembayaran Diproses"}
          </h1>

          <p className="mx-auto mt-3 max-w-sm text-sm font-medium leading-relaxed text-neutral-500">
            {message}
          </p>

          <div className="mt-6 grid gap-3 text-left">
            <DetailRow icon={ReceiptText} label="Order ID" value={orderId || "-"} />
            <DetailRow icon={Crown} label="Paket" value={plan?.label || payment?.plan || "-"} />
            <DetailRow icon={Clock3} label="Status" value={payment?.status || (polling ? "checking" : "-")} />
            <DetailRow icon={ReceiptText} label="Nominal" value={payment ? fmtRp(payment.amount) : "-"} />
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onGoDashboard}
              className="flex min-h-[46px] flex-1 items-center justify-center gap-1.5 rounded-full bg-navy px-5 text-sm font-bold text-white shadow-float"
            >
              <Home size={16} />
              Ke Dashboard
            </button>
            <button
              type="button"
              onClick={onGoAccount}
              className="flex min-h-[46px] flex-1 items-center justify-center gap-1.5 rounded-full bg-white/80 px-5 text-sm font-bold text-navy shadow-soft"
            >
              Akun
              <ArrowRight size={16} />
            </button>
          </div>
        </section>

        <p className="mx-auto mt-5 max-w-sm text-center text-xs font-medium leading-relaxed text-neutral-500">
          Jika status belum berubah, jangan ulangi pembayaran untuk order yang sama. Tunggu beberapa saat karena notifikasi
          dari payment gateway kadang membutuhkan waktu.
        </p>
      </main>
    </div>
  );
}
