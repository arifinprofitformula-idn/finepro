import { CirclePlus, Home, ReceiptText, UserRound } from "lucide-react";

const NAV_ITEMS = [
  { key: "dashboard", label: "Beranda", icon: Home },
  { key: "add", label: "Catat", icon: CirclePlus, isAction: true },
  { key: "history", label: "Riwayat", icon: ReceiptText },
  { key: "account", label: "Akun", icon: UserRound }
];

export default function BottomNav({ page, onNavigate, onAdd, addDisabled }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 flex justify-center">
      <div className="gloss-panel grid h-[74px] w-full max-w-lg grid-cols-4 items-stretch rounded-t-3xl border-b-0 px-2 pb-[env(safe-area-inset-bottom)] pt-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = page === item.key;
          const itemClass = `flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium transition-colors ${
            active ? "bg-violet-light text-violet" : "text-neutral-500"
          }`;

          if (item.isAction) {
            return (
              <button
                key={item.key}
                type="button"
                onClick={onAdd}
                disabled={addDisabled}
                className={`${itemClass} text-violet disabled:opacity-50`}
                aria-label="Catat transaksi"
              >
                <span className="flex h-7 w-7 items-center justify-center">
                  <Icon size={20} strokeWidth={2.2} />
                </span>
                <span className="h-4 leading-4">Catat</span>
              </button>
            );
          }

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
              className={itemClass}
              aria-current={active ? "page" : undefined}
            >
              <span className="flex h-7 w-7 items-center justify-center">
                <Icon size={20} strokeWidth={active ? 2.2 : 2} fill={item.key === "dashboard" && active ? "currentColor" : "none"} />
              </span>
              <span className="h-4 leading-4">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
