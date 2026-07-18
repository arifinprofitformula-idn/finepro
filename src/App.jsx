// src/App.jsx
// Routing user-app tetap state-based (tanpa react-router-dom): layar utama
// cukup di-switch lewat kondisi user+household. Route URL khusus hanya
// dipakai untuk Admin Console terpisah di /admin lewat src/main.jsx.

import { useEffect, useState } from "react";
import { useAuth } from "./hooks/useAuth.js";
import { useHousehold } from "./hooks/useHousehold.js";
import { useCategories } from "./hooks/useCategories.js";
import { useInvites } from "./hooks/useInvites.js";
import { useDashboard } from "./hooks/useDashboard.js";
import { addTransaction } from "./api/transactions.js";
import { planLabel } from "./api/subscriptions.js";
import AuthPage from "./pages/AuthPage.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage.jsx";
import OnboardingPage from "./pages/OnboardingPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import AccountPage from "./pages/AccountPage.jsx";
import SettingPage from "./pages/SettingPage.jsx";
import PaymentFinishPage from "./pages/PaymentFinishPage.jsx";
import PaymentNotificationPage from "./pages/PaymentNotificationPage.jsx";
import PricingPage from "./pages/PricingPage.jsx";
import CheckoutPage from "./pages/CheckoutPage.jsx";
import AppHeader from "./components/AppHeader.jsx";
import BottomNav from "./components/BottomNav.jsx";
import InstallPrompt from "./components/InstallPrompt.jsx";
import TransactionModal from "./components/TransactionModal.jsx";
import { currentMonthKey } from "./utils/format.js";

const SELECTED_PERIOD_KEY = "finepro-selected-period";
const DAY_MS = 24 * 60 * 60 * 1000;

function dayStart(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysUntilDate(value) {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((dayStart(target).getTime() - dayStart().getTime()) / DAY_MS);
}

function getSubscriptionWarning(household) {
  if (!household || household.subscription_status !== "active") return null;
  const daysLeft = daysUntilDate(household.current_period_end);
  if (daysLeft === null || daysLeft < 0 || daysLeft > 7) return null;
  return { daysLeft };
}

function SplashScreen() {
  return (
    <div className="app-glow-bg min-h-screen flex flex-col items-center justify-center gap-3">
      <div className="gloss-panel flex h-20 w-20 items-center justify-center overflow-hidden rounded-[28px] bg-white p-2 shadow-float animate-auth-float">
        <img
          src="/icon-192.png"
          alt="FinePro"
          className="h-full w-full rounded-2xl object-cover"
        />
      </div>
      <div className="text-sm font-medium text-neutral-500">Memuat...</div>
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
  const categories = useCategories(household?.id);
  const { categoriesExpense, categoriesIncome } = categories;
  const { invites, refresh: refreshInvites } = useInvites(!!household);
  const [page, setPage] = useState("dashboard");
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [selectedMonthKey, setSelectedMonthKeyState] = useState(() => {
    const saved = localStorage.getItem(SELECTED_PERIOD_KEY);
    return /^\d{4}-\d{2}$/.test(saved || "") ? saved : currentMonthKey();
  });
  const dashboard = useDashboard(household?.id, selectedMonthKey);
  const isPrivacyPath = ["/privacy", "/kebijakan-privasi"].includes(window.location.pathname);
  const isPaymentFinishPath = window.location.pathname === "/payment/finish";
  const isPaymentNotificationPath = window.location.pathname === "/payment/notification";

  function setSelectedMonthKey(next) {
    setSelectedMonthKeyState(next);
    localStorage.setItem(SELECTED_PERIOD_KEY, next);
  }

  // Deteksi redirect balik dari Midtrans (?order_id=...) dan poll status pembayaran.
  useEffect(() => {
    if (!household) return;
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order_id");
    if (!orderId || isPaymentFinishPath) return;

    window.location.replace(`/payment/finish?order_id=${encodeURIComponent(orderId)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household?.id, isPaymentFinishPath]);

  // Deteksi reset_token dari URL — langsung buka AuthPage mode reset
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reset_token")) {
      setAuthMode("reset");
      setShowAuth(true);
    }
  }, []);

  if (initializing) return <SplashScreen />;
  if (isPrivacyPath) {
    return <PrivacyPolicyPage />;
  }
  if (isPaymentNotificationPath) {
    return <PaymentNotificationPage />;
  }
  if (!user) {
    if (!showAuth) {
      return (
        <LandingPage
          onGetStarted={() => { setAuthMode("signup"); setShowAuth(true); }}
          onLogin={() => { setAuthMode("login"); setShowAuth(true); }}
        />
      );
    }
    return <AuthPage initialMode={authMode} onBack={() => setShowAuth(false)} />;
  }
  if (householdLoading) return <SplashScreen />;

  if (!household) {
    return <OnboardingPage onCreateHousehold={createHousehold} onInviteAccepted={refreshHousehold} />;
  }

  if (isPaymentFinishPath) {
    return (
      <PaymentFinishPage
        onPaid={refreshHousehold}
        onGoDashboard={() => {
          window.history.replaceState({}, "", "/");
          setPage("dashboard");
        }}
        onGoAccount={() => {
          window.history.replaceState({}, "", "/");
          setPage("account");
        }}
      />
    );
  }

  if (page === "upgrade") {
    return (
      <PricingPage
        onSelectPlan={(planId) => { setSelectedUpgradePlan(planId); setPage("checkout"); }}
        onBack={() => setPage("account")}
      />
    );
  }

  if (page === "checkout") {
    return (
      <CheckoutPage
        plan={selectedUpgradePlan}
        onBack={() => setPage("upgrade")}
        onDone={async () => {
          setSelectedUpgradePlan(null);
          await refreshHousehold();
          setPage("account");
        }}
      />
    );
  }

  const subscriptionExpired = household.subscription_status === "expired";
  const subscriptionWarning = getSubscriptionWarning(household);
  const notificationCount = invites.length + (subscriptionWarning ? 1 : 0);

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
    <div className="app-glow-bg min-h-screen pb-[78px]">
      <AppHeader
        user={user}
        planLabel={planLabel(household)}
        notificationCount={notificationCount}
        hasSubscriptionWarning={Boolean(subscriptionWarning)}
        onNavigateAccount={() => setPage("account")}
        onNavigateAdmin={() => { window.location.href = "/admin"; }}
      />

      {page === "dashboard" && (
        <DashboardPage
          household={household}
          transactions={dashboard.transactions}
          kpi={dashboard.kpi}
          previousKpi={dashboard.previousKpi}
          budgets={dashboard.budgets}
          byCategory={dashboard.byCategory}
          categoriesExpense={categoriesExpense}
          onDataChanged={dashboard.refresh}
          selectedMonthKey={selectedMonthKey}
          onPeriodChange={setSelectedMonthKey}
        />
      )}

      {page === "history" && (
        <HistoryPage
          household={household}
          categoriesExpense={categoriesExpense}
          categoriesIncome={categoriesIncome}
          onDataChanged={dashboard.refresh}
          selectedMonthKey={selectedMonthKey}
        />
      )}

      {page === "account" && (
        <AccountPage
          user={user}
          household={household}
          invites={invites}
          onUserUpdated={updateUser}
          onDataChanged={dashboard.refresh}
          onInvitesChanged={refreshInvites}
          onNavigateUpgrade={() => setPage("upgrade")}
        />
      )}

      {page === "setting" && (
        <SettingPage
          user={user}
          household={household}
          categoriesExpense={categoriesExpense}
          categoriesIncome={categoriesIncome}
          onCreateCategory={categories.createCategory}
          onRenameCategory={categories.renameCategory}
          onDeleteCategory={categories.deleteCategory}
          onUserUpdated={updateUser}
          onHouseholdUpdated={setHousehold}
          onLogout={logout}
        />
      )}

      <BottomNav page={page} onNavigate={setPage} onAdd={handleOpenModal} />
      <InstallPrompt />

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
