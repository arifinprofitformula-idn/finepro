// src/App.jsx
// Routing state-based (tanpa react-router-dom): 4 layar (auth/onboarding/
// dashboard/account) cukup di-switch lewat kondisi user+household, sama
// seperti pola view/page di versi Alpine — lebih ringan, tanpa perlu
// konfigurasi SPA-fallback tambahan di Nginx. Konsekuensinya: tidak ada
// URL per halaman, jadi tidak ada isu refresh-di-URL-mana-pun yang perlu
// ditangani Nginx (poin 4 Step 4 di dokumen migrasi jadi otomatis aman).

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "./hooks/useAuth.js";
import { useHousehold } from "./hooks/useHousehold.js";
import { useCategories } from "./hooks/useCategories.js";
import { useInvites } from "./hooks/useInvites.js";
import { useDashboard } from "./hooks/useDashboard.js";
import { usePaymentStatus } from "./hooks/usePaymentStatus.js";
import { addTransaction } from "./api/transactions.js";
import { planLabel } from "./api/subscriptions.js";
import AuthPage from "./pages/AuthPage.jsx";
import OnboardingPage from "./pages/OnboardingPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import AccountPage from "./pages/AccountPage.jsx";
import AppHeader from "./components/AppHeader.jsx";
import BottomNav from "./components/BottomNav.jsx";
import TransactionModal from "./components/TransactionModal.jsx";

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
  const { user, initializing, logout, updateUser } = useAuth();
  const {
    household,
    loading: householdLoading,
    createHousehold,
    refresh: refreshHousehold,
    setHousehold
  } = useHousehold(user);
  const { categoriesExpense, categoriesIncome } = useCategories(household?.id);
  const { invites, refresh: refreshInvites } = useInvites(!!household);
  const dashboard = useDashboard(household?.id);
  const paymentStatus = usePaymentStatus();
  const [page, setPage] = useState("dashboard");
  const [modalOpen, setModalOpen] = useState(false);

  // Deteksi redirect balik dari Midtrans (?order_id=...) dan poll status pembayaran.
  useEffect(() => {
    if (!household) return;
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order_id");
    if (!orderId) return;

    window.history.replaceState({}, "", window.location.pathname);
    setPage("account");
    paymentStatus.poll(orderId, refreshHousehold);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household?.id]);

  if (initializing) return <SplashScreen />;
  if (!user) return <AuthPage />;
  if (householdLoading) return <SplashScreen />;

  if (!household) {
    return <OnboardingPage onCreateHousehold={createHousehold} onInviteAccepted={refreshHousehold} />;
  }

  const subscriptionExpired = household.subscription_status === "expired";

  function handleOpenModal() {
    if (subscriptionExpired) {
      alert("Langganan Anda telah berakhir. Perpanjang dulu di halaman Akun untuk menambah transaksi baru.");
      return;
    }
    setModalOpen(true);
  }

  async function handleAddTransaction(payload) {
    await addTransaction({ householdId: household.id, userId: user.id, ...payload });
    await dashboard.refresh();
  }

  return (
    <div className="min-h-screen bg-neutral-bg pb-[60px]">
      <AppHeader
        user={user}
        planLabel={planLabel(household)}
        pendingInviteCount={invites.length}
        onNavigateAccount={() => setPage("account")}
      />

      {page === "dashboard" && (
        <DashboardPage
          household={household}
          transactions={dashboard.transactions}
          kpi={dashboard.kpi}
          budgets={dashboard.budgets}
          byCategory={dashboard.byCategory}
          categoriesExpense={categoriesExpense}
          onDataChanged={dashboard.refresh}
        />
      )}

      {page === "account" && (
        <AccountPage
          user={user}
          household={household}
          invites={invites}
          paymentPolling={paymentStatus.polling}
          paymentStatusMsg={paymentStatus.statusMsg}
          onUserUpdated={updateUser}
          onHouseholdUpdated={setHousehold}
          onInvitesChanged={refreshInvites}
          onLogout={logout}
        />
      )}

      <button
        type="button"
        onClick={handleOpenModal}
        className="fixed bottom-[76px] right-4 w-12 h-12 rounded-full bg-gold text-white flex items-center justify-center shadow-lg z-20"
        aria-label="Tambah transaksi"
      >
        <Plus size={22} />
      </button>

      <BottomNav page={page} onNavigate={setPage} onAdd={handleOpenModal} />

      <TransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleAddTransaction}
        categoriesExpense={categoriesExpense}
        categoriesIncome={categoriesIncome}
        isStudent={household.household_type === "student"}
      />
    </div>
  );
}
