import { ShieldAlert } from "lucide-react";
import { useMemo } from "react";

function formatNarrative(text) {
  if (!text) return "";
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

// Disclaimer di bawah SELALU tampil dan tidak bisa di-dismiss — ini guardrail
// non-negosiasi untuk fitur AI Insight (Fase 8), bukan sekadar keputusan UX.
export default function InsightCard({ narrative, rateLimitMessage }) {
  const html = useMemo(() => formatNarrative(narrative), [narrative]);

  if (!narrative) return null;

  return (
    <div className="gloss-panel mb-4 rounded-2xl p-4">
      {rateLimitMessage && (
        <div className="mb-3 rounded-xl bg-gold-light px-3 py-2 text-xs font-semibold text-gold">
          {rateLimitMessage}
        </div>
      )}
      <div
        className="whitespace-pre-line text-sm leading-relaxed text-navy"
        dangerouslySetInnerHTML={{ __html: html }}
      />
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
