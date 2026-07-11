import { Wallet } from "lucide-react";
import { fmtRp } from "../utils/format.js";

export default function WalletCard({ wallet }) {
  return (
    <div className="flex items-center justify-between border-b border-neutral-border py-2 last:border-0">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-light text-violet">
          <Wallet size={15} />
        </div>
        <div className="text-sm font-semibold text-neutral-900">
          {wallet.name} {wallet.is_default && <span className="text-xs font-normal text-neutral-500">(utama)</span>}
        </div>
      </div>
      <div className="text-sm font-bold text-neutral-900">{fmtRp(wallet.balance)}</div>
    </div>
  );
}
