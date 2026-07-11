// src/components/AppHeader.jsx
// Header persisten (avatar + sapaan + lonceng notifikasi) — bukan bagian
// eksplisit dari daftar komponen dokumen migrasi, tapi ini fitur app-shell
// yang sudah ada di versi Alpine dan dipertahankan di sini supaya tidak
// hilang diam-diam saat migrasi.

import { Bell } from "lucide-react";

export default function AppHeader({ user, planLabel, pendingInviteCount, onNavigateAccount }) {
  const name = user?.name || user?.email?.split("@")[0] || "";
  const firstName = name.split(" ")[0];
  const initial = (user?.name || user?.email || "?").charAt(0).toUpperCase();

  return (
    <div className="sticky top-0 z-10 bg-neutral-bg/95 backdrop-blur px-4 py-3 flex items-center justify-between max-w-lg mx-auto">
      <button type="button" onClick={onNavigateAccount} className="flex items-center gap-2.5 text-left min-h-[44px]">
        <div className="w-11 h-11 rounded-full overflow-hidden bg-navy text-white flex items-center justify-center font-bold text-base flex-shrink-0">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            initial
          )}
        </div>
        <div>
          <div className="text-[15px] font-bold text-neutral-900 leading-tight">Hi, {firstName}!</div>
          <div className="text-[11px] text-neutral-500">{planLabel}</div>
        </div>
      </button>
      <button
        type="button"
        onClick={onNavigateAccount}
        className="w-9 h-9 rounded-lg border border-neutral-border bg-white flex items-center justify-center relative"
        title="Notifikasi"
      >
        <Bell size={16} />
        {pendingInviteCount > 0 && (
          <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-danger border-2 border-white" />
        )}
      </button>
    </div>
  );
}
