import { RotateCcw, Wallet } from "lucide-react";
import { fmtRp } from "../utils/format.js";

export default function WalletCard({ wallet, onReconcile }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-border py-3 last:border-0">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-light text-violet">
          <Wallet size={15} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-neutral-900">
            {wallet.name} {wallet.is_default && <span className="text-xs font-normal text-neutral-500">(utama)</span>}
          </div>
          <div className="text-sm font-bold text-neutral-900">{fmtRp(wallet.balance)}</div>
        </div>
      </div>
      {wallet.can_reconcile && onReconcile && (
        <button
          type="button"
          onClick={() => onReconcile(wallet)}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-violet px-3 text-xs font-bold text-violet"
        >
          <RotateCcw size={13} />
          Kalibrasi
        </button>
      )}
    </div>
  );
}
