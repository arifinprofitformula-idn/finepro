import { Home, Plus, User } from "lucide-react";

export default function BottomNav({ page, onNavigate, onAdd, addDisabled }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 flex justify-center px-0">
      <div className="gloss-panel flex h-[78px] w-full max-w-lg items-center justify-around rounded-t-[30px] border-b-0 pb-[env(safe-area-inset-bottom)]">
      <button
        type="button"
        onClick={() => onNavigate("dashboard")}
        className={`flex min-h-[58px] min-w-[72px] flex-col items-center justify-center gap-1 text-sm ${
          page === "dashboard" ? "text-violet font-semibold" : "text-neutral-500 font-medium"
        }`}
      >
        <Home size={28} fill={page === "dashboard" ? "currentColor" : "none"} />
        Beranda
      </button>
      <button
        type="button"
        onClick={onAdd}
        disabled={addDisabled}
        className="flex min-h-[58px] min-w-[72px] flex-col items-center justify-center gap-1 text-sm font-medium text-neutral-500 disabled:opacity-50"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-neutral-500/80">
          <Plus size={24} />
        </span>
        Tambah
      </button>
      <button
        type="button"
        onClick={() => onNavigate("account")}
        className={`flex min-h-[58px] min-w-[72px] flex-col items-center justify-center gap-1 text-sm ${
          page === "account" ? "text-violet font-semibold" : "text-neutral-500 font-medium"
        }`}
      >
        <User size={28} />
        Akun
      </button>
      </div>
    </div>
  );
}
