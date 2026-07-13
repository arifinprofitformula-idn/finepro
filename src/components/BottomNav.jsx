import { CirclePlus, Home, ReceiptText, Settings, UserRound } from "lucide-react";

const NAV_ITEMS = [
  { key: "dashboard", label: "Beranda", icon: Home },
  { key: "history", label: "Riwayat", icon: ReceiptText },
  { key: "account", label: "Akun", icon: UserRound },
  { key: "setting", label: "Setting", icon: Settings }
];

export default function BottomNav({ page, onNavigate, onAdd, addDisabled }) {
  const leftItems = NAV_ITEMS.slice(0, 2);
  const rightItems = NAV_ITEMS.slice(2);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 flex justify-center">
      <div className="relative w-full max-w-lg">
        <button
          type="button"
          onClick={onAdd}
          disabled={addDisabled}
          className="absolute left-1/2 -top-6 z-10 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full bg-violet text-white shadow-float ring-4 ring-white/80 disabled:opacity-50"
          aria-label="Transaksi"
        >
          <CirclePlus size={28} strokeWidth={2.2} />
        </button>

        <div className="gloss-panel grid h-[74px] grid-cols-5 items-stretch rounded-t-3xl border-b-0 px-2 pb-[env(safe-area-inset-bottom)] pt-2">
          {leftItems.map((item) => (
            <NavButton key={item.key} item={item} active={page === item.key} onNavigate={onNavigate} />
          ))}

          <div aria-hidden="true" />

          {rightItems.map((item) => (
            <NavButton key={item.key} item={item} active={page === item.key} onNavigate={onNavigate} />
          ))}
        </div>
      </div>
    </div>
  );
}

function NavButton({ item, active, onNavigate }) {
  const Icon = item.icon;
  const itemClass = `flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium transition-colors ${
    active ? "bg-violet-light text-violet" : "text-neutral-500"
  }`;

  return (
    <button
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
}
