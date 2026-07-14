import { useEffect, useState } from "react";
import { adminLogout, getCurrentAdmin } from "./api/admin.js";
import AdminLoginPage from "./pages/AdminLoginPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";

function AdminSplash() {
  return (
    <div className="app-glow-bg flex min-h-screen flex-col items-center justify-center gap-3">
      <div className="gloss-panel flex h-20 w-20 items-center justify-center overflow-hidden rounded-[28px] bg-white p-2 shadow-float animate-auth-float">
        <img
          src="/icon-192.png"
          alt="FinePro"
          className="h-full w-full rounded-2xl object-cover"
        />
      </div>
      <div className="text-sm font-medium text-neutral-500">Memuat Admin Console...</div>
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
