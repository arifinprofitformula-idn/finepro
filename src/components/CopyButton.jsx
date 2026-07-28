import { useState } from "react";
import { Copy, Check } from "lucide-react";

export default function CopyButton({ value, label = "" }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement("textarea");
      el.value = String(value);
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Tersalin!" : `Salin ${label}`}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all ${
        copied
          ? "bg-emerald-100 text-emerald-600 ring-1 ring-emerald-300"
          : "bg-neutral-100 text-neutral-400 hover:bg-violet/10 hover:text-violet"
      }`}
    >
      {copied ? <Check size={15} /> : <Copy size={15} />}
    </button>
  );
}
