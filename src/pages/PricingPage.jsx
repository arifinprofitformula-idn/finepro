// src/pages/PricingPage.jsx
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Crown, Star } from "lucide-react";
import { getPricing } from "../api/payments.js";
import { PLAN_LABELS } from "../api/subscriptions.js";
import { PLAN_ORDER, formatPlanPrice, AiCreditTermsNote } from "../components/UpgradeCheckout.jsx";

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
  quarterly: ["Semua fitur Fine Pro", "Akses 3 bulan", "Dukungan prioritas"],
  annual: ["Semua fitur Fine Pro", "Akses 12 bulan", "Harga per bulan paling hemat", "Dukungan prioritas"],
  lifetime: ["Semua fitur non-AI selamanya", "Kredit AI awal di muka, akumulatif & tidak reset", "Sekali bayar, tanpa perpanjangan"],
};

function fmtCredit(value) {
  return Number(value || 0).toLocaleString("id-ID");
}

// Fitur AI berbasis kuota reset (Quarterly/Annual) vs kredit akumulatif (Lifetime) —
// datanya live dari GET /payments/pricing (aiQuota/aiCredit) supaya selalu sinkron
// dengan angka yang benar-benar berlaku di sistem, bukan salinan statis yang bisa basi.
function getPlanFeatures(id, pricing) {
  const base = [...(BASE_PLAN_FEATURES[id] || [])];
  const q = pricing?.aiQuota;
  if (!q) return base;

  if (id === "quarterly") {
    base.push(`Scan Struk AI ${q.short_scan_monthly}x/bulan, AI Insight ${q.short_insight_daily}x/hari`);
  } else if (id === "annual") {
    base.push(`Scan Struk AI ${q.annual_scan_monthly}x/bulan, AI Insight ${q.annual_insight_daily}x/hari`);
  }
  return base;
}

const QUOTA_TABLE_ROWS = [
  {
    feature: "Scan Struk Otomatis",
    short: (q) => `${q.short_scan_monthly}x / bulan`,
    annual: (q) => `${q.annual_scan_monthly}x / bulan`,
    lifetime: (c) => `${fmtCredit(c?.receipt_scan)} kredit`,
  },
  {
    feature: "AI Insight",
    short: (q) => `${q.short_insight_daily}x / hari`,
    annual: (q) => `${q.annual_insight_daily}x / hari`,
    lifetime: (c) => `${fmtCredit(c?.ai_insight)} kredit`,
  },
  {
    feature: "Chat AI Telegram",
    short: (q) => `${q.short_telegram_daily}x / hari`,
    annual: (q) => `${q.annual_telegram_daily}x / hari`,
    lifetime: (c) => `${fmtCredit(c?.telegram_chat)} kredit`,
  },
  {
    feature: "Chat AI WhatsApp",
    short: (q) => `${q.short_whatsapp_daily}x / hari`,
    annual: (q) => `${q.annual_whatsapp_daily}x / hari`,
    lifetime: (c) => `${fmtCredit(c?.whatsapp_chat)} kredit`,
  },
];

function AiQuotaTable({ pricing }) {
  const aiQuota = pricing?.aiQuota;
  const lifetimeGrant = pricing?.aiCredit?.lifetime_grant;
  if (!aiQuota) return null;

  return (
    <section className="gloss-panel mt-4 rounded-[28px] p-5">
      <div className="text-sm font-bold text-navy">Detail Kuota Kredit AI per Paket</div>
      <p className="mt-1 text-xs font-medium leading-relaxed text-neutral-500">
        Paket 3 Bulan &amp; Tahunan memakai kuota yang reset otomatis (harian/bulanan). Paket Lifetime memakai
        Kredit AI awal yang bersifat akumulatif — tidak reset, dan bisa di-top-up bila habis.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-xs">
          <thead>
            <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-neutral-400">
              <th className="py-2 pr-2">Fitur AI</th>
              <th className="px-2 py-2">3 Bulan</th>
              <th className="px-2 py-2">Tahunan</th>
              <th className="pl-2 py-2">Lifetime (Kredit Awal)</th>
            </tr>
          </thead>
          <tbody>
            {QUOTA_TABLE_ROWS.map((row) => (
              <tr key={row.feature} className="border-t border-neutral-border/60">
                <td className="py-2.5 pr-2 font-semibold text-navy">{row.feature}</td>
                <td className="px-2 py-2.5 text-neutral-600">{row.short(aiQuota)}</td>
                <td className="px-2 py-2.5 text-neutral-600">{row.annual(aiQuota)}</td>
                <td className="py-2.5 pl-2 font-semibold text-violet">{row.lifetime(lifetimeGrant)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function PricingPage({ onSelectPlan, onBack }) {
  const [pricing, setPricing] = useState(null);

  useEffect(() => {
    getPricing().then(setPricing).catch(() => setPricing(null));
  }, []);

  return (
    <div className="app-glow-bg min-h-screen px-5 py-8">
      <main className="mx-auto w-full max-w-lg">
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-navy shadow-soft"
          >
            <ArrowLeft size={18} />
          </button>
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
            Lanjutkan menikmati semua fitur Fine Pro setelah masa trial berakhir.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {PLAN_ORDER.filter((id) => pricing?.plans?.[id]).map((id) => {
            const p = pricing.plans[id];
            const isRecommended = id === "annual";
            return (
              <section
                key={id}
                className={
                  isRecommended
                    ? "relative rounded-[28px] border-2 border-violet bg-gradient-to-br from-violet-light via-white to-white p-5 shadow-float scale-[1.02]"
                    : "gloss-panel rounded-[28px] p-5"
                }
              >
                {isRecommended && (
                  <div className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-violet px-3 py-1 text-[11px] font-bold text-white shadow-float">
                    <Star size={12} className="fill-white" />
                    RECOMMENDED
                  </div>
                )}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-base font-bold text-navy">
                      {PLAN_LABELS[id]}
                      {p.isPromo && (
                        <span className="ml-1.5 rounded-full bg-coral-light px-2 py-0.5 text-[10px] font-bold text-coral">Early Access</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-sm font-semibold text-violet">{formatPlanPrice(id, p)}</div>
                  </div>
                </div>

                <ul className="mt-3 flex flex-col gap-1.5">
                  {getPlanFeatures(id, pricing).map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs font-medium text-neutral-600">
                      <Check size={14} className="mt-0.5 flex-shrink-0 text-mint" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => onSelectPlan(id)}
                  className={
                    isRecommended
                      ? "mt-4 flex h-11 w-full items-center justify-center rounded-full bg-violet text-sm font-bold text-white shadow-float ring-2 ring-violet/30"
                      : "mt-4 flex h-11 w-full items-center justify-center rounded-full bg-violet text-sm font-bold text-white shadow-float"
                  }
                >
                  Pilih {PLAN_LABELS[id]}
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
