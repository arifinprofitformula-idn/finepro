// src/components/AppHeader.jsx
// Header persisten (avatar + sapaan + lonceng notifikasi) — bukan bagian
// eksplisit dari daftar komponen dokumen migrasi, tapi ini fitur app-shell
// yang sudah ada di versi Alpine dan dipertahankan di sini supaya tidak
// hilang diam-diam saat migrasi.

import { Bell, ShieldCheck } from "lucide-react";
import { mediaUrl } from "../utils/media.js";

export default function AppHeader({ user, planLabel, pendingInviteCount, onNavigateAccount, onNavigateAdmin }) {
  const name = user?.name || user?.email?.split("@")[0] || "";
  const firstName = name.split(" ")[0];
  const initial = (user?.name || user?.email || "?").charAt(0).toUpperCase();
  const isAdmin = ["admin", "super_admin"].includes(user?.role);

  return (
    <div className="sticky top-0 z-10 max-w-lg mx-auto px-4 pt-3 pb-3 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onNavigateAccount} className="flex min-h-11 min-w-0 items-center gap-2.5 text-left">
          <div className="h-11 w-11 rounded-full border-2 border-white bg-violet text-white shadow-soft flex items-center justify-center overflow-hidden text-base font-semibold flex-shrink-0">
            {user?.avatar_url ? (
              <img src={mediaUrl(user.avatar_url)} alt="" className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-semibold leading-tight text-navy">
              Hi, {firstName}! <span aria-hidden="true">👋</span>
            </div>
            <div className="truncate text-xs font-medium text-neutral-500">{planLabel}</div>
          </div>
        </button>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {isAdmin && (
            <button
              type="button"
              onClick={onNavigateAdmin}
              className="gloss-button flex h-9 w-9 items-center justify-center rounded-full text-violet"
              title="Admin Console"
            >
              <ShieldCheck size={17} strokeWidth={2.3} />
            </button>
          )}
          <button
            type="button"
            onClick={onNavigateAccount}
            className="gloss-button flex h-9 w-9 items-center justify-center rounded-full relative text-navy"
            title="Notifikasi"
          >
            <Bell size={17} strokeWidth={2.2} className={pendingInviteCount > 0 ? "animate-bell-ring origin-top" : ""} />
            {pendingInviteCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-coral px-1 text-center text-[10px] font-medium leading-[18px] text-white">
                {pendingInviteCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
