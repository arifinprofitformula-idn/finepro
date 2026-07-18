// src/components/UpgradeCheckout.jsx
// Form pilih paket + checkout (transfer manual atau gateway Midtrans/Xendit).
// Dipakai di AccountPage (alur "Perpanjang/Ganti Paket") dan di CheckoutPage
// (alur upgrade dari Trial lewat halaman perbandingan paket).
import { useState, useEffect } from "react";
import {
  createPayment,
  getPaymentMethods,
  submitManualPayment,
  getPricing,
} from "../api/payments.js";
import { PLAN_LABELS } from "../api/subscriptions.js";
import { fmtRp } from "../utils/format.js";
import { Crown, ShieldCheck } from "lucide-react";

export const PLAN_ORDER = ["quarterly", "annual", "lifetime"];

const inputClass =
  "h-11 w-full min-w-0 rounded-full border border-neutral-border bg-white/70 px-4 text-sm font-medium text-navy outline-none backdrop-blur";
const primaryBtnClass =
  "flex h-11 items-center justify-center gap-1.5 rounded-full bg-violet px-4 text-sm font-bold text-white disabled:opacity-60";
const secondaryBtnClass =
  "flex h-9 items-center justify-center gap-1.5 self-start rounded-full border border-violet bg-white/70 px-4 text-xs font-bold text-violet disabled:opacity-60";

let snapScriptPromise = null;

function loadSnapScript({ snapUrl, clientKey }) {
  if (!snapUrl || !clientKey) {
    return Promise.reject(new Error("Konfigurasi Midtrans belum lengkap."));
  }

  if (window.snap?.pay) return Promise.resolve(window.snap);

  const existing = document.querySelector(`script[src="${snapUrl}"]`);
  if (existing && snapScriptPromise) return snapScriptPromise;

  snapScriptPromise = new Promise((resolve, reject) => {
    const script = existing || document.createElement("script");
    script.src = snapUrl;
    script.setAttribute("data-client-key", clientKey);
    script.async = true;
    script.onload = () => {
      if (window.snap?.pay) resolve(window.snap);
      else reject(new Error("Midtrans Snap gagal dimuat."));
    };
    script.onerror = () => reject(new Error("Tidak dapat memuat Midtrans Snap."));
    if (!existing) document.body.appendChild(script);
  });

  return snapScriptPromise;
}

export function formatPlanPrice(planId, planConfig) {
  if (!planConfig) return "";
  const price = fmtRp(planConfig.amount);
  if (planId === "lifetime") return `${price} (sekali bayar)`;
  if (planConfig.months === 1) return `${price} / bulan`;
  return `${price} / ${planConfig.months} bulan`;
}

function StatusMsg({ msg, type }) {
  if (!msg) return null;
  return (
    <div className={`mt-2 rounded-xl px-3 py-2 text-xs font-medium ${type === "error" ? "bg-coral-light text-coral" : "bg-mint-light text-mint"}`}>
      {msg}
    </div>
  );
}

export function AiCreditTermsNote({ className = "mt-2 rounded-2xl bg-gold-light/60 p-3" }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`${className} text-xs text-navy`}>
      <p className="font-semibold">Ketentuan Kredit AI — Paket Lifetime</p>
      <p className="mt-1 leading-relaxed text-neutral-600">
        Paket Lifetime memberi akses selamanya untuk seluruh fitur non-AI. Fitur AI (scan struk, AI Insight, chat
        WhatsApp/Telegram) memakai <strong>Kredit AI</strong> awal yang diberikan sekali di muka dan tidak reset
        otomatis. Jika kredit habis, Anda bisa membeli Top-Up Kredit AI seharga Rp124.500 secara opsional — tidak ada
        auto-charge dalam bentuk apapun. Fitur non-AI tetap berfungsi normal meski kredit AI habis.
      </p>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-1.5 text-[11px] font-bold text-violet underline"
      >
        {expanded ? "Sembunyikan detail" : "Lihat ketentuan lengkap"}
      </button>
      {expanded && (
        <div className="mt-2 rounded-xl bg-white/70 p-2.5 text-[11px] leading-relaxed text-neutral-600">
          Detail lengkap ketentuan Kredit AI — termasuk kuota acuan per fitur, mekanisme top-up, dan kebijakan
          perubahan — tersedia di halaman{" "}
          <a href="/privacy" className="font-semibold text-violet underline">Kebijakan Privasi</a>{" "}
          bagian "Ketentuan Kredit AI Paket Lifetime".
        </div>
      )}
    </div>
  );
}

function LifetimeTermsBox({ accepted, onAcceptedChange }) {
  return (
    <div className="mt-2 rounded-2xl bg-gold-light/60 p-3 text-xs text-navy">
      <AiCreditTermsNote className="" />
      <label className="mt-2 flex items-start gap-2 text-[11px] font-medium text-navy">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => onAcceptedChange(e.target.checked)}
          className="mt-0.5"
        />
        Saya sudah membaca dan menyetujui Ketentuan Kredit AI Paket Lifetime di atas.
      </label>
    </div>
  );
}

export default function UpgradeCheckout({ defaultPlan, onClose, showCancelButton, onPaymentHistoryChanged }) {
  const [payingPlan, setPayingPlan] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [manualPlan, setManualPlan] = useState(PLAN_ORDER.includes(defaultPlan) ? defaultPlan : "quarterly");
  const [manualReference, setManualReference] = useState("");
  const [manualFile, setManualFile] = useState(null);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualMsg, setManualMsg] = useState("");
  const [manualMsgType, setManualMsgType] = useState("");
  const [lifetimeTermsAccepted, setLifetimeTermsAccepted] = useState(false);

  useEffect(() => {
    getPaymentMethods().then(setPaymentMethods).catch(() => setPaymentMethods({ active: null, midtrans: { enabled: false }, xendit: { enabled: false }, manual: { enabled: false } }));
    getPricing().then(setPricing).catch(() => setPricing(null));
  }, []);

  async function refreshPaymentHistory() {
    try {
      await onPaymentHistoryChanged?.();
    } catch {
      // Tidak kritis; riwayat akan dimuat ulang saat halaman dibuka kembali.
    }
  }

  async function handleUpgrade(planId) {
    if (planId === "lifetime" && !lifetimeTermsAccepted) {
      alert("Anda harus menyetujui Ketentuan Kredit AI Lifetime terlebih dahulu.");
      return;
    }
    setPayingPlan(planId);
    try {
      if (paymentMethods?.active === "xendit") {
        if (!paymentMethods?.xendit?.enabled) {
          throw new Error("Metode pembayaran Xendit belum aktif. Hubungi admin Fine Pro.");
        }
        const { invoiceUrl } = await createPayment(planId);
        window.location.href = invoiceUrl;
        return;
      }

      if (!paymentMethods?.midtrans?.enabled) {
        throw new Error("Metode pembayaran Midtrans belum aktif. Hubungi admin Fine Pro.");
      }

      const { orderId, token, redirectUrl } = await createPayment(planId);
      const snap = await loadSnapScript(paymentMethods.midtrans);

      snap.pay(token, {
        onSuccess: () => {
          window.location.href = `/payment/finish?order_id=${encodeURIComponent(orderId)}`;
        },
        onPending: () => {
          window.location.href = `/payment/finish?order_id=${encodeURIComponent(orderId)}`;
        },
        onError: () => {
          alert("Pembayaran gagal diproses oleh Midtrans. Silakan coba lagi.");
          setPayingPlan(null);
        },
        onClose: async () => {
          setPayingPlan(null);
          await refreshPaymentHistory();
        }
      });

      if (!window.snap?.pay && redirectUrl) {
        window.location.href = redirectUrl;
      }
    } catch (err) {
      alert("Gagal memulai pembayaran: " + err.message);
      setPayingPlan(null);
    }
  }

  async function handleManualSubmit(e) {
    e.preventDefault();
    if (manualPlan === "lifetime" && !lifetimeTermsAccepted) {
      setManualMsg("Anda harus menyetujui Ketentuan Kredit AI Lifetime terlebih dahulu.");
      setManualMsgType("error");
      return;
    }
    if (!manualFile) {
      setManualMsg("Unggah bukti transfer terlebih dahulu.");
      setManualMsgType("error");
      return;
    }
    setManualSubmitting(true);
    setManualMsg("");
    try {
      await submitManualPayment({ plan: manualPlan, reference: manualReference, file: manualFile });
      setManualMsg("Klaim pembayaran terkirim. Admin akan memverifikasi bukti transfer Anda.");
      setManualMsgType("success");
      setManualReference("");
      setManualFile(null);
      await refreshPaymentHistory();
      onClose?.();
    } catch (err) {
      setManualMsg(err.message);
      setManualMsgType("error");
    } finally {
      setManualSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-neutral-500">
        <Crown size={13} />
        {paymentMethods?.active === "manual" ? "Upgrade Paket — Transfer Manual" : "Upgrade Paket"}
      </div>

      {paymentMethods?.active === "manual" ? (
        paymentMethods?.manual?.enabled ? (
          <>
            <div className="mb-3 rounded-2xl bg-white/70 p-3 text-xs text-navy">
              <div className="font-semibold">{paymentMethods.manual.bank_name}</div>
              <div>No. Rekening: <span className="font-semibold">{paymentMethods.manual.account_number}</span></div>
              <div>a.n. {paymentMethods.manual.account_name}</div>
              {paymentMethods.manual.instructions && (
                <p className="mt-2 text-neutral-500">{paymentMethods.manual.instructions}</p>
              )}
            </div>
            <form onSubmit={handleManualSubmit} className="flex flex-col gap-2">
              <label htmlFor="manual-plan" className="text-xs font-medium text-neutral-500">Pilih Paket</label>
              <select
                id="manual-plan"
                className={inputClass}
                value={manualPlan}
                onChange={(e) => setManualPlan(e.target.value)}
              >
                {PLAN_ORDER.filter((id) => pricing?.plans?.[id]).map((id) => (
                  <option key={id} value={id}>{PLAN_LABELS[id]} — {formatPlanPrice(id, pricing.plans[id])}</option>
                ))}
              </select>
              {manualPlan === "lifetime" && (
                <LifetimeTermsBox accepted={lifetimeTermsAccepted} onAcceptedChange={setLifetimeTermsAccepted} />
              )}
              <label htmlFor="manual-reference" className="text-xs font-medium text-neutral-500">No. Referensi / Berita Transfer (opsional)</label>
              <input
                id="manual-reference"
                type="text"
                className={inputClass}
                value={manualReference}
                onChange={(e) => setManualReference(e.target.value)}
                placeholder="Contoh: 4 digit terakhir rekening pengirim"
              />
              <label htmlFor="manual-proof" className="text-xs font-medium text-neutral-500">Bukti Transfer</label>
              <input
                id="manual-proof"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setManualFile(e.target.files[0] || null)}
                className="text-xs"
              />
              <button type="submit" disabled={manualSubmitting} className={`${primaryBtnClass} mt-1`}>
                {manualSubmitting ? "Mengirim..." : "Kirim Klaim Pembayaran"}
              </button>
              <StatusMsg msg={manualMsg} type={manualMsgType} />
            </form>
          </>
        ) : (
          <div className="flex items-start gap-2 rounded-2xl bg-gold-light p-3 text-xs font-semibold text-gold">
            <ShieldCheck size={15} className="mt-0.5 flex-shrink-0" />
            <span>Transfer manual belum aktif. Hubungi admin Fine Pro.</span>
          </div>
        )
      ) : (
        <>
          <p className="mb-2 text-xs text-neutral-500">
            {paymentMethods?.active === "xendit"
              ? "Pembayaran diproses via Xendit, otomatis aktif setelah bayar."
              : "Pembayaran diproses via Midtrans, otomatis aktif setelah bayar."}
          </p>
          <div className={`mb-3 flex items-start gap-2 rounded-2xl p-3 text-xs font-semibold ${
            (paymentMethods?.active === "xendit" ? paymentMethods?.xendit?.enabled : paymentMethods?.midtrans?.enabled)
              ? "bg-mint-light text-mint" : "bg-gold-light text-gold"
          }`}>
            <ShieldCheck size={15} className="mt-0.5 flex-shrink-0" />
            <span>
              {paymentMethods === null
                ? "Memeriksa konfigurasi pembayaran..."
                : paymentMethods?.active === "xendit"
                ? (paymentMethods?.xendit?.enabled
                  ? "Xendit aktif. Pilih paket untuk membuka metode pembayaran."
                  : "Xendit belum aktif. Admin perlu mengisi Secret Key di Admin Console.")
                : (paymentMethods?.midtrans?.enabled
                  ? "Midtrans Snap aktif. Pilih paket untuk membuka metode pembayaran."
                  : "Midtrans belum aktif. Admin perlu mengisi Server Key dan Client Key di Admin Console.")}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {PLAN_ORDER.filter((id) => pricing?.plans?.[id]).map((id) => {
              const p = pricing.plans[id];
              const gatewayEnabled = paymentMethods?.active === "xendit" ? paymentMethods?.xendit?.enabled : paymentMethods?.midtrans?.enabled;
              const blockedByTerms = id === "lifetime" && !lifetimeTermsAccepted;
              return (
                <div
                  key={id}
                  className={`rounded-2xl bg-white/70 p-3 ${id === defaultPlan ? "ring-2 ring-violet" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-navy">
                        {PLAN_LABELS[id]}
                        {p.isPromo && (
                          <span className="ml-1.5 rounded-full bg-coral-light px-2 py-0.5 text-[10px] font-bold text-coral">Early Access</span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-500">{formatPlanPrice(id, p)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUpgrade(id)}
                      disabled={payingPlan === id || !gatewayEnabled || blockedByTerms}
                      className="flex h-10 items-center justify-center rounded-full bg-gold px-4 text-xs font-bold text-white disabled:opacity-60"
                    >
                      {payingPlan === id ? "Membuka..." : "Pilih"}
                    </button>
                  </div>
                  {id === "lifetime" && (
                    <LifetimeTermsBox accepted={lifetimeTermsAccepted} onAcceptedChange={setLifetimeTermsAccepted} />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {showCancelButton && (
        <button type="button" onClick={onClose} className={`${secondaryBtnClass} mt-2 border-neutral-border text-neutral-500`}>
          Batal
        </button>
      )}
    </div>
  );
}
