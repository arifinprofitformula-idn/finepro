// src/App.jsx
// Routing state-based (tanpa react-router-dom): 4 layar (auth/onboarding/
// dashboard/account) cukup di-switch lewat kondisi user+household, sama
// seperti pola view/page di versi Alpine — lebih ringan, tanpa perlu
// konfigurasi SPA-fallback tambahan di Nginx.

import { useAuth } from "./hooks/useAuth.js";
import { useHousehold } from "./hooks/useHousehold.js";
import AuthPage from "./pages/AuthPage.jsx";
import OnboardingPage from "./pages/OnboardingPage.jsx";

function SplashScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-neutral-bg">
      <div className="w-14 h-14 rounded-2xl bg-navy text-white flex items-center justify-center font-bold text-xl">
        KK
      </div>
      <div className="text-sm text-neutral-500">Memuat...</div>
    </div>
  );
}

export default function App() {
  const { user, initializing } = useAuth();
  const { household, loading: householdLoading, createHousehold, refresh } = useHousehold(user);

  if (initializing) return <SplashScreen />;
  if (!user) return <AuthPage />;
  if (householdLoading) return <SplashScreen />;

  if (!household) {
    return <OnboardingPage onCreateHousehold={createHousehold} onInviteAccepted={refresh} />;
  }

  // DashboardPage/AccountPage dibangun di Step 3-4.
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-bg px-6">
      <div className="rounded-lg bg-navy px-4 py-2 text-white text-sm font-semibold shadow text-center">
        Household siap: {household.name}
        <br />
        Dashboard dibangun di Step 3
      </div>
    </div>
  );
}
