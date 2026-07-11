import { ShieldAlert } from "lucide-react";

// Disclaimer di bawah SELALU tampil dan tidak bisa di-dismiss — ini guardrail
// non-negosiasi untuk fitur AI Insight (Fase 8), bukan sekadar keputusan UX.
export default function InsightCard({ narrative, rateLimitMessage }) {
  if (!narrative) return null;

  return (
    <div className="gloss-panel mb-4 rounded-2xl p-4">
      {rateLimitMessage && (
        <div className="mb-3 rounded-xl bg-gold-light px-3 py-2 text-xs font-semibold text-gold">
          {rateLimitMessage}
        </div>
      )}
      <div className="whitespace-pre-line text-sm leading-relaxed text-navy">{narrative}</div>
      <div className="mt-3 flex items-start gap-2 border-t border-neutral-border pt-3 text-xs text-neutral-500">
        <ShieldAlert size={14} className="mt-0.5 flex-shrink-0" />
        <span>
          Analisis ini berbasis data Anda sendiri, dihasilkan AI, bukan nasihat keuangan profesional. Untuk keputusan
          besar, konsultasikan dengan ahli.
        </span>
      </div>
    </div>
  );
}
