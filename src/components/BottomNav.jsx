import { Home, ListOrdered, Plus, User } from "lucide-react";

const NAV_ITEMS = [
  { key: "dashboard", label: "Beranda", icon: Home },
  { key: "add", label: "Catat", icon: Plus, isAction: true },
  { key: "history", label: "Riwayat", icon: ListOrdered },
  { key: "account", label: "Akun", icon: User }
];

export default function BottomNav({ page, onNavigate, onAdd, addDisabled }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 flex justify-center">
      <div className="gloss-panel grid h-[76px] w-full max-w-lg grid-cols-4 items-stretch rounded-t-3xl border-b-0 px-2 pb-[env(safe-area-inset-bottom)] pt-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = page === item.key;

          if (item.isAction) {
            return (
              <button
                key={item.key}
                type="button"
                onClick={onAdd}
                disabled={addDisabled}
                className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-medium text-violet disabled:opacity-50"
                aria-label="Catat transaksi"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet text-white shadow-soft">
                  <Icon size={21} strokeWidth={2.4} />
                </span>
                <span className="leading-none">Catat</span>
              </button>
            );
          }

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-medium transition-colors ${
                active ? "bg-violet-light text-violet" : "text-neutral-500"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={22} strokeWidth={active ? 2.4 : 2} fill={item.key === "dashboard" && active ? "currentColor" : "none"} />
              <span className="leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
