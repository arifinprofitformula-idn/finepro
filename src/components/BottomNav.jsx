import { Home, ListOrdered, Plus, User } from "lucide-react";

export default function BottomNav({ page, onNavigate, onAdd, addDisabled }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 flex justify-center px-0">
      <div className="gloss-panel flex h-[78px] w-full max-w-lg items-center justify-around rounded-t-[30px] border-b-0 pb-[env(safe-area-inset-bottom)]">
        <button
          type="button"
          onClick={() => onNavigate("dashboard")}
          className={`flex min-h-[58px] min-w-[64px] flex-col items-center justify-center gap-1 text-sm ${
            page === "dashboard" ? "text-violet font-semibold" : "text-neutral-500 font-medium"
          }`}
        >
          <Home size={26} fill={page === "dashboard" ? "currentColor" : "none"} />
          Beranda
        </button>

        <button
          type="button"
          onClick={onAdd}
          disabled={addDisabled}
          className="flex min-h-[58px] min-w-[64px] flex-col items-center justify-center gap-1 text-sm font-semibold text-violet disabled:opacity-50"
        >
          <span className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-violet text-white shadow-float">
            <Plus size={26} strokeWidth={2.3} />
          </span>
          Catat
        </button>

        <button
          type="button"
          onClick={() => onNavigate("history")}
          className={`flex min-h-[58px] min-w-[64px] flex-col items-center justify-center gap-1 text-sm ${
            page === "history" ? "text-violet font-semibold" : "text-neutral-500 font-medium"
          }`}
        >
          <ListOrdered size={26} />
          Riwayat
        </button>

        <button
          type="button"
          onClick={() => onNavigate("account")}
          className={`flex min-h-[58px] min-w-[64px] flex-col items-center justify-center gap-1 text-sm ${
            page === "account" ? "text-violet font-semibold" : "text-neutral-500 font-medium"
          }`}
        >
          <User size={26} />
          Akun
        </button>
      </div>
    </div>
  );
}
