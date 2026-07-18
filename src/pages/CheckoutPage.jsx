// src/pages/CheckoutPage.jsx
import { ArrowLeft, Crown } from "lucide-react";
import UpgradeCheckout from "../components/UpgradeCheckout.jsx";

function BrandLogo() {
  return (
    <img
      src="/images/fine-pro-header.png"
      alt="Fine Pro"
      className="h-12 w-auto object-contain"
    />
  );
}

export default function CheckoutPage({ plan, onBack, onDone }) {
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
            Checkout
          </div>
          <h1 className="mt-3 text-2xl font-bold leading-tight text-navy">Selesaikan Pembayaran</h1>
        </div>

        <section className="gloss-panel rounded-[28px] p-5">
          <UpgradeCheckout defaultPlan={plan} onClose={onDone} showCancelButton={true} />
        </section>
      </main>
    </div>
  );
}
