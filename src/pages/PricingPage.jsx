// src/pages/PricingPage.jsx
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Crown, Star } from "lucide-react";
import { getPricing } from "../api/payments.js";
import { PLAN_LABELS } from "../api/subscriptions.js";
import {
  PLAN_ORDER,
  formatPlanPrice,
  AiCreditTermsNote,
  getStoredLifetimeTermsAccepted,
  setStoredLifetimeTermsAccepted,
} from "../components/UpgradeCheckout.jsx";
import OnboardingProgress from "../components/OnboardingProgress.jsx";

function BrandLogo() {
  return (
    <img
      src="/images/fine-pro-header.png"
      alt="Fine Pro"
      className="h-12 w-auto object-contain"
    />
  );
}

const BASE_PLAN_FEATURES = {
  monthly: ["Semua fitur Fine Pro", "Akses 1 bulan", "Paket hemat tanpa kontrak panjang"],
  quarterly: ["Semua fitur Fine Pro", "Akses 3 bulan", "Dukungan prioritas"],
  annual: ["Semua fitur Fine Pro", "Akses 12 bulan", "Harga per bulan paling hemat", "Dukungan prioritas"],
  lifetime: ["Semua fitur non-AI selamanya", "Kredit AI awal di muka, akumulatif & tidak reset", "Sekali bayar, tanpa perpanjangan"],
};

const PLAN_CARD_THEMES = {
  monthly: {
    panel:
      "border-[#3b82f6]/35 bg-gradient-to-br from-white via-[#eff6ff] to-white hover:border-[#2563eb] hover:shadow-[0_22px_48px_rgba(37,99,235,0.18)]",
    selected: "border-[#2563eb] ring-4 ring-[#2563eb]/20 shadow-[0_24px_52px_rgba(37,99,235,0.24)]",
    badge: "bg-[#dbeafe] text-[#1d4ed8]",
    icon: "bg-[#2563eb]/10 text-[#1d4ed8]",
    price: "text-[#1d4ed8]",
    check: "text-[#2563eb]",
    button: "bg-[#2563eb] hover:bg-[#1d4ed8] focus:ring-[#2563eb]/30",
  },
  quarterly: {
    panel:
      "border-mint/35 bg-gradient-to-br from-white via-mint-light to-white hover:border-mint hover:shadow-[0_22px_48px_rgba(24,197,148,0.18)]",
    selected: "border-mint ring-4 ring-mint/20 shadow-[0_24px_52px_rgba(24,197,148,0.24)]",
    badge: "bg-mint-light text-success",
    icon: "bg-mint/10 text-success",
    price: "text-success",
    check: "text-mint",
    button: "bg-mint hover:bg-success focus:ring-mint/30",
  },
  annual: {
    panel:
      "border-violet/45 bg-gradient-to-br from-violet-light via-white to-white hover:border-violet hover:shadow-[0_22px_48px_rgba(111,85,242,0.2)]",
    selected: "border-violet ring-4 ring-violet/25 shadow-[0_24px_52px_rgba(111,85,242,0.28)]",
    badge: "bg-violet text-white",
    icon: "bg-violet/10 text-violet",
    price: "text-violet",
    check: "text-violet",
    button: "bg-violet hover:bg-navy focus:ring-violet/30",
  },
  lifetime: {
    panel:
      "border-gold/45 bg-gradient-to-br from-white via-[#fff7ed] to-white hover:border-[#ea580c] hover:shadow-[0_22px_48px_rgba(234,88,12,0.18)]",
    selected: "border-[#ea580c] ring-4 ring-[#ea580c]/20 shadow-[0_24px_52px_rgba(234,88,12,0.24)]",
    badge: "bg-gold-light text-[#7c2d12]",
    icon: "bg-gold-light/70 text-[#9a3412]",
    price: "text-[#9a3412]",
    check: "text-[#ea580c]",
    button: "bg-[#ea580c] hover:bg-[#c2410c] focus:ring-[#ea580c]/30",
  },
};

function fmtCredit(value) {
  return Number(value || 0).toLocaleString("id-ID");
}

// Paket berulang memakai unlimited fair use; Lifetime memakai kredit finite.
// Grant Lifetime dibaca live dari GET /payments/pricing agar tampilan selalu sinkron.
function getPlanFeatures(id, pricing) {
  const base = [...(BASE_PLAN_FEATURES[id] || [])];
  const q = pricing?.aiQuota;
  if (!q) return base;

  if (["monthly", "quarterly", "annual"].includes(id)) {
    base.push("Scan WhatsApp & Telegram unlimited fair use");
    base.push("Chat AI dan Insight unlimited fair use");
  }
  return base;
}

const AI_ACCESS_ROWS = [
  { feature: "Scan Struk Otomatis", lifetimeKey: "receipt_scan" },
  { feature: "AI Insight", lifetimeKey: "ai_insight" },
  { feature: "Chat AI Telegram", lifetimeKey: "telegram_chat" },
  { feature: "Chat AI WhatsApp", lifetimeKey: "whatsapp_chat" },
];

function AiQuotaTable({ pricing }) {
  const lifetimeGrant = pricing?.aiCredit?.lifetime_grant;
  if (!lifetimeGrant) return null;

  return (
    <section className="gloss-panel mt-4 rounded-[28px] p-5">
      <div className="text-sm font-bold text-navy">Detail Akses AI per Paket</div>
      <p className="mt-1 text-xs font-medium leading-relaxed text-neutral-500">
        Paket Bulanan, 3 Bulan, dan Tahunan memakai akses AI unlimited fair use. Batas internal hanya melindungi layanan dari bot dan penyalahgunaan. Paket Lifetime memakai Kredit AI awal yang akumulatif dan bisa di-top-up.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-xs">
          <thead>
            <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-neutral-400">
              <th className="py-2 pr-2">Fitur AI</th>
              <th className="px-2 py-2">Paket Berulang</th>
              <th className="pl-2 py-2">Lifetime (Kredit Awal)</th>
            </tr>
          </thead>
          <tbody>
            {AI_ACCESS_ROWS.map((row) => (
              <tr key={row.feature} className="border-t border-neutral-border/60">
                <td className="py-2.5 pr-2 font-semibold text-navy">{row.feature}</td>
                <td className="px-2 py-2.5 font-semibold text-mint">Unlimited fair use</td>
                <td className="py-2.5 pl-2 font-semibold text-violet">{fmtCredit(lifetimeGrant?.[row.lifetimeKey])} kredit</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LifetimeTermsOverlay({
  accepted,
  onAcceptedChange,
  onClose,
  onContinue,
}) {
  function handleAcceptedChange(next) {
    setStoredLifetimeTermsAccepted(next);
    onAcceptedChange(next);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/55 px-4 py-5 backdrop-blur-sm sm:items-center">
      <section className="w-full max-w-md rounded-[28px] border border-white/80 bg-white p-5 shadow-[0_28px_70px_rgba(15,31,61,0.28)]">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-gold-light px-3 py-1 text-[11px] font-bold text-[#7c2d12]">
          <Crown size={13} />
          Lifetime Terms
        </div>
        <h2 className="mt-3 text-xl font-bold leading-tight text-navy">
          Setujui Terms &amp; Conditions terlebih dahulu
        </h2>
        <p className="mt-2 text-sm font-medium leading-relaxed text-neutral-600">
          Silakan setujui Terms &amp; Conditions untuk melanjutkan pembayaran paket Lifetime.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold text-neutral-400">
          <span className={accepted ? "text-mint" : "text-violet"}>Terms</span>
          <span className={accepted ? "text-violet" : ""}>Payment</span>
          <span>Confirmation</span>
        </div>

        <a
          href="/privacy#lifetime-terms"
          className="mt-4 flex h-11 w-full items-center justify-center rounded-full bg-violet text-sm font-bold text-white shadow-soft transition hover:bg-navy"
        >
          Baca &amp; Setujui Terms
        </a>

        <label className="mt-4 flex items-start gap-2 rounded-2xl bg-gold-light/60 p-3 text-xs font-medium leading-relaxed text-navy">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => handleAcceptedChange(e.target.checked)}
            className="mt-0.5"
          />
          Saya sudah membaca dan menyetujui Terms &amp; Conditions paket Lifetime.
        </label>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 items-center justify-center rounded-full border border-neutral-border bg-white text-sm font-bold text-neutral-600"
          >
            Nanti Dulu
          </button>
          <div className="relative">
            <button
              type="button"
              disabled={!accepted}
              onClick={onContinue}
              className="flex h-11 w-full items-center justify-center rounded-full bg-[#ea580c] text-sm font-bold text-white shadow-soft transition hover:bg-[#c2410c] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Lanjut Bayar
            </button>
            {!accepted && (
              <button
                type="button"
                aria-label="Terms Lifetime belum disetujui"
                onClick={() => alert("Silakan setujui Terms & Conditions untuk melanjutkan pembayaran Lifetime.")}
                className="absolute inset-0 rounded-full"
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function PricingPage({ onSelectPlan, onBack, onboardingFlow = false }) {
  const [pricing, setPricing] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [lifetimeTermsAccepted, setLifetimeTermsAccepted] = useState(getStoredLifetimeTermsAccepted);
  const [showLifetimeTerms, setShowLifetimeTerms] = useState(false);

  useEffect(() => {
    getPricing().then(setPricing).catch(() => setPricing(null));
  }, []);

  function handleSelectPlan(planId) {
    if (planId === "lifetime" && !lifetimeTermsAccepted) {
      setSelectedPlan(planId);
      setShowLifetimeTerms(true);
      return;
    }
    setSelectedPlan(planId);
    onSelectPlan(planId);
  }

  function continueLifetimeCheckout() {
    setStoredLifetimeTermsAccepted(true);
    setLifetimeTermsAccepted(true);
    setShowLifetimeTerms(false);
    setSelectedPlan("lifetime");
    onSelectPlan("lifetime");
  }

  return (
    <div className="app-glow-bg min-h-screen px-5 py-8">
      {showLifetimeTerms && (
        <LifetimeTermsOverlay
          accepted={lifetimeTermsAccepted}
          onAcceptedChange={setLifetimeTermsAccepted}
          onClose={() => setShowLifetimeTerms(false)}
          onContinue={continueLifetimeCheckout}
        />
      )}
      <main className="mx-auto w-full max-w-5xl">
        {onboardingFlow && <OnboardingProgress current={3} />}
        <div className="mb-6 flex items-center justify-between">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-navy shadow-soft"
            >
              <ArrowLeft size={18} />
            </button>
          ) : (
            // Step wajib pilih paket dalam onboarding (household sudah dibuat,
            // tanpa free trial) — tidak ada langkah mundur yang valid di sini,
            // jadi tombol back tidak ditampilkan sama sekali (bukan tombol
            // yang terlihat aktif tapi diam saat diklik).
            <div className="h-10 w-10" />
          )}
          <BrandLogo />
          <div className="w-10" />
        </div>

        <div className="mb-6 text-center">
          <div className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-white/75 px-3 py-1 text-[11px] font-bold text-violet">
            <Crown size={13} />
            Upgrade Fine Pro
          </div>
          <h1 className="mt-3 text-2xl font-bold leading-tight text-navy">Pilih Paket Langganan</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm font-medium leading-relaxed text-neutral-500">
            Pilih paket berbayar dan nikmati semua fitur inti sejak hari pertama. Tanpa free trial.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PLAN_ORDER.filter((id) => pricing?.plans?.[id]).map((id) => {
            const p = pricing.plans[id];
            const isRecommended = id === "annual";
            const isSelected = selectedPlan === id;
            const theme = PLAN_CARD_THEMES[id] || PLAN_CARD_THEMES.monthly;
            return (
              <section
                key={id}
                aria-label={`Paket ${PLAN_LABELS[id]}`}
                className={
                  `relative flex h-full flex-col rounded-[28px] border-2 p-5 shadow-soft transition duration-200 hover:-translate-y-1 ${theme.panel} ${
                    isSelected ? theme.selected : ""
                  }`
                }
              >
                {isRecommended && (
                  <div className={`absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold shadow-float ${theme.badge}`}>
                    <Star size={12} className="fill-white" />
                    RECOMMENDED
                  </div>
                )}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-base font-bold text-navy">
                      {PLAN_LABELS[id]}
                      {p.isPromo && (
                        <span className="ml-1.5 rounded-full bg-coral-light px-2 py-0.5 text-[10px] font-bold text-coral">Early Access</span>
                      )}
                    </div>
                    <div className={`mt-1 text-sm font-bold ${theme.price}`}>{formatPlanPrice(id, p)}</div>
                  </div>
                  {isRecommended && (
                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl ${theme.icon}`}>
                      <Crown size={17} />
                    </div>
                  )}
                </div>

                <ul className="mt-4 flex flex-1 flex-col gap-2">
                  {getPlanFeatures(id, pricing).map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs font-medium text-neutral-600">
                      <Check size={14} className={`mt-0.5 flex-shrink-0 ${theme.check}`} />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleSelectPlan(id)}
                  className={
                    `mt-5 flex h-11 w-full items-center justify-center rounded-full text-sm font-bold text-white shadow-soft transition focus:outline-none focus:ring-4 ${
                      isSelected ? "ring-4" : ""
                    } ${theme.button}`
                  }
                >
                  {isSelected ? "Terpilih" : `Pilih ${PLAN_LABELS[id]}`}
                </button>
              </section>
            );
          })}

          {pricing === null && (
            <div className="gloss-panel rounded-[28px] p-5 text-center text-sm text-neutral-500">
              Memuat paket...
            </div>
          )}
        </div>

        <AiQuotaTable pricing={pricing} />

        <footer className="mt-6 border-t border-neutral-border/60 pt-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">Syarat &amp; Ketentuan</div>
          <AiCreditTermsNote />
          <p className="mt-4 text-center text-xs font-medium text-neutral-500">
            Dengan melanjutkan, Anda menyetujui{" "}
            <a href="/privacy" className="font-bold text-violet hover:underline">Kebijakan Privasi</a> Fine Pro.
          </p>
        </footer>
      </main>
    </div>
  );
}
