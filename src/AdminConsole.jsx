import { useEffect, useState } from "react";
import { LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { adminLogout, getCurrentAdmin } from "./api/admin.js";
import AdminLoginPage from "./pages/AdminLoginPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";

function AdminSplash() {
  return (
    <div className="app-glow-bg flex min-h-screen flex-col items-center justify-center gap-3">
      <div className="gloss-panel flex h-16 w-16 items-center justify-center rounded-3xl bg-violet text-white">
        <RefreshCw size={23} className="animate-spin" />
      </div>
      <div className="text-sm font-bold text-neutral-500">Memuat Admin Console...</div>
    </div>
  );
}

export default function AdminConsole() {
  const [admin, setAdmin] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const current = await getCurrentAdmin();
      if (!cancelled) {
        setAdmin(current);
        setInitializing(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleLogout() {
    await adminLogout();
    setAdmin(null);
  }

  if (initializing) return <AdminSplash />;
  if (!admin) return <AdminLoginPage onLoggedIn={setAdmin} />;

  return (
    <div className="app-glow-bg min-h-screen">
      <div className="sticky top-0 z-20 border-b border-white/70 bg-white/65 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => { window.location.href = "/"; }}
            className="flex min-w-0 items-center gap-2 text-left"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-navy text-white shadow-soft">
              <ShieldCheck size={19} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-navy">Finepro Admin</div>
              <div className="truncate text-xs font-semibold text-neutral-500">{admin.email} · {admin.role}</div>
            </div>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="gloss-button flex h-10 items-center justify-center gap-2 rounded-full px-3 text-sm font-bold text-navy sm:px-4"
            title="Keluar Admin"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </div>
      <div className="pt-4">
        <AdminPage user={admin} />
      </div>
    </div>
  );
}
