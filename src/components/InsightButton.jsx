import { BrainCircuit, Loader2 } from "lucide-react";

export default function InsightButton({ onClick, loading }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="gloss-panel mb-4 flex w-full items-center justify-center gap-2 rounded-2xl p-3 text-sm font-semibold text-violet disabled:opacity-60"
    >
      {loading ? <Loader2 size={17} className="animate-spin" /> : <BrainCircuit size={17} />}
      {loading ? "Menganalisis..." : "Analisa Keuangan"}
    </button>
  );
}
