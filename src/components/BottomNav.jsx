import { Home, Plus, User } from "lucide-react";

export default function BottomNav({ page, onNavigate, onAdd, addDisabled }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-border flex justify-around items-center h-[60px] pb-[env(safe-area-inset-bottom)] z-20">
      <button
        type="button"
        onClick={() => onNavigate("dashboard")}
        className={`flex flex-col items-center gap-0.5 min-w-[44px] min-h-[44px] justify-center text-[10px] ${
          page === "dashboard" ? "text-navy font-bold" : "text-neutral-500"
        }`}
      >
        <Home size={20} />
        Beranda
      </button>
      <button
        type="button"
        onClick={onAdd}
        disabled={addDisabled}
        className="flex flex-col items-center gap-0.5 min-w-[44px] min-h-[44px] justify-center text-[10px] text-neutral-500 disabled:opacity-50"
      >
        <Plus size={20} />
        Tambah
      </button>
      <button
        type="button"
        onClick={() => onNavigate("account")}
        className={`flex flex-col items-center gap-0.5 min-w-[44px] min-h-[44px] justify-center text-[10px] ${
          page === "account" ? "text-navy font-bold" : "text-neutral-500"
        }`}
      >
        <User size={20} />
        Akun
      </button>
    </div>
  );
}
