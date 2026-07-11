// src/components/AppHeader.jsx
// Header persisten (avatar + sapaan + lonceng notifikasi) — bukan bagian
// eksplisit dari daftar komponen dokumen migrasi, tapi ini fitur app-shell
// yang sudah ada di versi Alpine dan dipertahankan di sini supaya tidak
// hilang diam-diam saat migrasi.

import { Bell, Sun } from "lucide-react";

export default function AppHeader({ user, planLabel, pendingInviteCount, onNavigateAccount }) {
  const name = user?.name || user?.email?.split("@")[0] || "";
  const firstName = name.split(" ")[0];
  const initial = (user?.name || user?.email || "?").charAt(0).toUpperCase();

  return (
    <div className="sticky top-0 z-10 max-w-lg mx-auto px-5 pt-4 pb-5">
      <div className="flex items-center justify-between gap-4">
        <button type="button" onClick={onNavigateAccount} className="flex min-h-16 min-w-0 items-center gap-3 text-left min-[430px]:min-h-[72px] min-[430px]:gap-4">
          <div className="h-16 w-16 rounded-full border-[5px] border-white bg-violet text-white shadow-soft flex items-center justify-center overflow-hidden text-2xl font-semibold flex-shrink-0 min-[430px]:h-[72px] min-[430px]:w-[72px] min-[430px]:text-3xl">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[24px] font-semibold leading-none text-navy min-[430px]:text-[30px]">
              Hi, {firstName}! <span aria-hidden="true">👋</span>
            </div>
            <div className="mt-2 truncate text-sm font-medium text-neutral-500 min-[430px]:text-base">{planLabel}</div>
          </div>
        </button>
        <div className="flex flex-shrink-0 items-center gap-2 min-[430px]:gap-3">
          <button
            type="button"
            className="gloss-button flex h-12 w-12 items-center justify-center rounded-full text-gold min-[430px]:h-16 min-[430px]:w-16"
            title="Tema"
          >
            <Sun size={24} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={onNavigateAccount}
            className="gloss-button flex h-12 w-12 items-center justify-center rounded-full relative text-navy min-[430px]:h-16 min-[430px]:w-16"
            title="Notifikasi"
          >
            <Bell size={24} strokeWidth={2.2} />
            <span className="absolute right-2.5 top-2.5 h-3 w-3 rounded-full bg-violet min-[430px]:right-3.5 min-[430px]:top-3.5" />
            {pendingInviteCount > 0 && (
              <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-coral px-1 text-center text-[10px] font-medium text-white">
                {pendingInviteCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
