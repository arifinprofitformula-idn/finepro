import { useEffect, useState } from "react";
import "@fontsource-variable/inter";
import { adminLogout, getCurrentAdmin } from "./api/admin.js";
import AdminLoginPage from "./pages/AdminLoginPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";

function AdminSplash() {
  return (
    <div className="font-admin relative flex min-h-screen flex-col items-center justify-center gap-3 overflow-hidden bg-[radial-gradient(circle_at_18%_15%,rgba(108,248,187,0.42),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(226,223,255,0.78),transparent_32%),radial-gradient(circle_at_70%_82%,rgba(255,218,220,0.58),transparent_34%),linear-gradient(135deg,#f8f9ff_0%,#dce9ff_48%,#f8f9ff_100%)]">
      <div className="pointer-events-none absolute -left-20 top-20 h-72 w-72 rounded-full bg-[#6cf8bb]/30 blur-3xl" />
      <div className="pointer-events-none absolute right-0 bottom-0 h-96 w-96 rounded-full bg-[#3525cd]/16 blur-3xl" />
      <div className="flex h-20 w-20 animate-auth-float items-center justify-center overflow-hidden rounded-[28px] border border-white/35 bg-white/22 p-2 shadow-[0_26px_70px_rgba(27,36,84,0.18),inset_1px_1px_0_rgba(255,255,255,0.72),inset_-1px_-1px_0_rgba(53,37,205,0.08)] backdrop-blur-2xl">
        <img
          src="/icon-192.png"
          alt="FinePro"
          className="h-full w-full rounded-2xl object-cover"
        />
      </div>
      <div className="rounded-full border border-white/30 bg-white/25 px-4 py-2 text-sm font-semibold text-[#26344a] shadow-[inset_1px_1px_0_rgba(255,255,255,0.62)] backdrop-blur-xl">
        Memuat Admin Console...
      </div>
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

  return <AdminPage user={admin} onLogout={handleLogout} />;
}
