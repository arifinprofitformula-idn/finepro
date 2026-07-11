// src/main.js
// Entry point aplikasi. Alpine.js dipakai hanya sebagai lapisan reactivity
// tipis (bukan framework besar) — semua logika data/bisnis tetap hidup
// di src/lib dan src/pages, main.js hanya menyambungkannya ke UI.
//
// v1.1 — Migrasi dari Supabase ke PostgreSQL + Express.js API

import Alpine from "alpinejs";
import { registerSW } from "virtual:pwa-register";

import { signUp, signIn, signOut, getSession, translateAuthError, uploadAvatar } from "./lib/auth.js";
import { getMyHousehold, createHousehold, updateMonthlyIncomeDay, HOUSEHOLD_TYPE_LABELS } from "./lib/households.js";
import { getCategories } from "./lib/categories.js";
import { addTransaction, exportMonthCSV } from "./lib/transactions.js";
import { setBudget } from "./lib/budgets.js";
import { planLabel } from "./lib/subscriptions.js";
import { createPayment, getPaymentStatus, PLANS } from "./lib/payments.js";
import { createInvite, getMyPendingInvites, acceptInvite } from "./lib/invites.js";
import { loadDashboardData } from "./pages/dashboard.js";
import { renderCategoryChart } from "./components/categoryChart.js";
import { fmtRp, todayStr, monthKey, daysUntilMonthlyDay } from "./utils/format.js";
import { getToken } from "./lib/apiClient.js";

// Registrasi service worker otomatis (vite-plugin-pwa)
registerSW({ immediate: true });

const THEME_STORAGE_KEY = "finepro-theme";
const DEFAULT_EXPENSE_CATEGORIES = [
  "Rumah Tangga",
  "Kesehatan",
  "Hiburan",
  "Tabungan & Investasi",
  "Ibadah & Sedekah",
  "Lainnya"
];

function applyTheme(theme) {
  const selected = theme === "light" ? "light" : "dark";
  document.documentElement.classList.toggle("theme-light", selected === "light");
  document.documentElement.classList.toggle("theme-dark", selected === "dark");
  document.documentElement.style.colorScheme = selected;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", selected === "light" ? "#F5F7FB" : "#0c1120");
}

function appState() {
  return {
    // ---- navigasi ----
    view: "loading", // loading | auth | onboarding | app
    page: "dashboard", // dashboard | account
    theme: localStorage.getItem(THEME_STORAGE_KEY) || "light",

    // ---- auth ----
    authMode: "login",
    authEmail: "",
    authPassword: "",
    authLoading: false,
    authMsg: "",
    authMsgType: "",
    userEmail: "",

    // ---- onboarding ----
    onboardLoading: false,

    // ---- undangan household ----
    pendingInvites: [],
    acceptingInviteId: null,
    inviteEmail: "",
    inviteLoading: false,
    inviteMsg: "",
    inviteMsgType: "",

    // ---- household/state utama ----
    currentUser: null,
    household: null,
    householdTypeLabel: "",
    planLabel: "Trial",
    avatarUploading: false,

    get greetingName() {
      if (!this.currentUser) return "";
      const name = this.currentUser.name || this.currentUser.email.split("@")[0];
      return name.split(" ")[0];
    },

    get avatarInitial() {
      const name = this.currentUser?.name || this.currentUser?.email || "?";
      return name.charAt(0).toUpperCase();
    },

    get subscriptionExpired() {
      return !!this.household && this.household.subscription_status === "expired";
    },

    // ---- langganan & pembayaran ----
    plans: PLANS,
    payingPlan: null,
    paymentPolling: false,
    paymentStatusMsg: "",

    // ---- fitur mahasiswa: tanggal uang bulanan ----
    monthlyIncomeDayInput: "",
    incomeDaySaving: false,
    incomeDayMsg: "",
    incomeDayMsgType: "",
    studentQuickCategories: ["Uang Makan", "Kuota & Internet", "Transportasi (Ojol/Motor)", "Nongkrong & Hiburan"],

    get daysUntilIncome() {
      if (!this.household || this.household.household_type !== "student") return null;
      return daysUntilMonthlyDay(this.household.monthly_income_day);
    },

    // ---- dashboard ----
    kpi: { income: 0, expense: 0 },
    transactions: [],
    dashboardLoading: false,
    dashboardError: "",

    // ---- budget vs realisasi ----
    budgets: {},
    byCategoryExpense: {},
    budgetInputs: {},
    budgetSavingCategory: null,
    budgetStatusMsg: "",
    exportLoading: false,

    get budgetProgress() {
      const names = Array.from(new Set([
        ...DEFAULT_EXPENSE_CATEGORIES,
        ...this.categoriesExpense.map(c => c.name)
      ]));
      return names.map(name => {
        const budget = this.budgets[name] || 0;
        const spent = this.byCategoryExpense[name] || 0;
        const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
        return { category: name, budget, spent, pct };
      });
    },

    // ---- modal tambah transaksi ----
    modalOpen: false,
    txType: "expense",
    txDate: todayStr(),
    txCategory: "",
    txAmount: "",
    txNote: "",
    categoriesExpense: [],
    categoriesIncome: [],

    get currentCategories() {
      return this.txType === "income" ? this.categoriesIncome : this.categoriesExpense;
    },

    fmtRp,

    calculateProgress(realization, budget) {
      const real = Number(realization) || 0;
      const target = Number(budget) || 0;
      if (target <= 0) return 0;
      return Math.min(100, Math.round((real / target) * 100));
    },

    getSummaryCards() {
      return [
        {
          key: "income",
          label: "Pemasukan",
          value: this.kpi.income,
          icon: "↗",
          hint: "+0% dari bulan lalu",
          className: "income-card"
        },
        {
          key: "expense",
          label: "Pengeluaran",
          value: this.kpi.expense,
          icon: "↘",
          hint: "+0% dari bulan lalu",
          className: "expense-card"
        },
        {
          key: "balance",
          label: "Saldo",
          value: this.kpi.income - this.kpi.expense,
          icon: "◔",
          hint: "+0% dari bulan lalu",
          className: "balance-card"
        }
      ];
    },

    getRecentTransactions() {
      if (!Array.isArray(this.transactions)) return [];
      return this.transactions.slice(0, 5).map(tx => ({
        ...tx,
        title: tx.note || tx.category || "Transaksi",
        icon: tx.type === "income" ? "↗" : "↘",
        dateLabel: tx.date || ""
      }));
    },

    toggleTheme() {
      this.theme = this.theme === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_STORAGE_KEY, this.theme);
      applyTheme(this.theme);
      if (this.page === "dashboard") {
        requestAnimationFrame(() => renderCategoryChart("categoryChart", this.byCategoryExpense));
      }
    },

    goToAddTransaction() {
      this.openModal();
    },

    budgetTone(category) {
      const normalized = category.toLowerCase();
      if (normalized.includes("rumah") || normalized.includes("kesehatan")) return "green";
      if (normalized.includes("hiburan") || normalized.includes("tabungan") || normalized.includes("investasi")) return "coral";
      if (normalized.includes("ibadah") || normalized.includes("sedekah") || normalized.includes("lain")) return "purple";
      return "green";
    },

    // =========================================================
    // INIT — dipanggil sekali saat halaman dibuka
    // =========================================================
    async init() {
      applyTheme(this.theme);
      const params = new URLSearchParams(window.location.search);
      const orderId = params.get("order_id");
      if (orderId) {
        window.history.replaceState({}, "", window.location.pathname);
      }

      const session = await getSession();
      if (session) {
        await this.enterAppFor(session.user);
        if (orderId) {
          this.page = "account";
          this.pollPaymentStatus(orderId);
        }
      } else {
        this.view = "auth";
      }
    },

    // =========================================================
    // AUTH
    // =========================================================
    async submitAuth() {
      this.authLoading = true;
      this.authMsg = "";
      try {
        let data;
        if (this.authMode === "signup") {
          data = await signUp(this.authEmail, this.authPassword);
        } else {
          data = await signIn(this.authEmail, this.authPassword);
        }
        await this.enterAppFor(data.user);
      } catch (err) {
        this.authMsg = translateAuthError(err.message);
        this.authMsgType = "error";
      } finally {
        this.authLoading = false;
      }
    },

    async uploadAvatarFile(event) {
      const file = event.target.files[0];
      if (!file) return;
      this.avatarUploading = true;
      try {
        this.currentUser = await uploadAvatar(file);
      } catch (err) {
        alert("Gagal mengunggah foto: " + err.message);
      } finally {
        this.avatarUploading = false;
        event.target.value = "";
      }
    },

    async logout() {
      await signOut();
      this.view = "auth";
      this.household = null;
      this.transactions = [];
    },

    // Setelah login/signup sukses: cek apakah user sudah punya household.
    // Kalau belum -> tampilkan onboarding pilih persona.
    async enterAppFor(user) {
      this.currentUser = user;
      this.userEmail = user.email;

      const household = await getMyHousehold(user.id);
      if (!household) {
        await this.refreshPendingInvites();
        this.view = "onboarding";
        return;
      }
      this.household = household;
      await this.afterHouseholdReady();
    },

    // =========================================================
    // ONBOARDING
    // =========================================================
    async createHousehold(type) {
      this.onboardLoading = true;
      try {
        const household = await createHousehold(this.currentUser.id, type);
        this.household = household;
        await this.afterHouseholdReady();
      } catch (err) {
        alert("Gagal membuat akun household: " + err.message);
      } finally {
        this.onboardLoading = false;
      }
    },

    async afterHouseholdReady() {
      this.householdTypeLabel = HOUSEHOLD_TYPE_LABELS[this.household.household_type] || this.household.household_type;
      this.monthlyIncomeDayInput = this.household.monthly_income_day || "";

      this.planLabel = planLabel(this.household);

      const [catExpense, catIncome] = await Promise.all([
        getCategories(this.household.id, "expense"),
        getCategories(this.household.id, "income")
      ]);
      this.categoriesExpense = catExpense;
      this.categoriesIncome = catIncome;
      this.txCategory = catExpense[0]?.name || "";

      this.view = "app";
      await this.refreshDashboard();
      await this.refreshPendingInvites();
    },

    // =========================================================
    // UNDANGAN HOUSEHOLD
    // =========================================================
    async refreshPendingInvites() {
      try {
        this.pendingInvites = await getMyPendingInvites();
      } catch {
        this.pendingInvites = [];
      }
    },

    async sendInvite() {
      this.inviteLoading = true;
      this.inviteMsg = "";
      try {
        await createInvite(this.inviteEmail);
        this.inviteEmail = "";
        this.inviteMsg = "Undangan terkirim. Anggota bisa menerimanya setelah login/daftar dengan email tersebut.";
        this.inviteMsgType = "success";
      } catch (err) {
        this.inviteMsg = err.message;
        this.inviteMsgType = "error";
      } finally {
        this.inviteLoading = false;
      }
    },

    async acceptInvite(inviteId) {
      this.acceptingInviteId = inviteId;
      try {
        await acceptInvite(inviteId);
        await this.enterAppFor(this.currentUser);
      } catch (err) {
        alert("Gagal menerima undangan: " + err.message);
      } finally {
        this.acceptingInviteId = null;
      }
    },

    // =========================================================
    // FITUR MAHASISWA: TANGGAL UANG BULANAN
    // =========================================================
    async saveMonthlyIncomeDay() {
      const day = this.monthlyIncomeDayInput ? parseInt(this.monthlyIncomeDayInput, 10) : null;
      if (day !== null && (!Number.isInteger(day) || day < 1 || day > 31)) {
        this.incomeDayMsg = "Tanggal harus 1-31.";
        this.incomeDayMsgType = "error";
        return;
      }

      this.incomeDaySaving = true;
      this.incomeDayMsg = "";
      try {
        this.household = await updateMonthlyIncomeDay(day);
        this.incomeDayMsg = "Tersimpan.";
        this.incomeDayMsgType = "success";
      } catch (err) {
        this.incomeDayMsg = err.message;
        this.incomeDayMsgType = "error";
      } finally {
        this.incomeDaySaving = false;
      }
    },

    // =========================================================
    // DASHBOARD
    // =========================================================
    async refreshDashboard() {
      this.dashboardLoading = true;
      this.dashboardError = "";
      try {
        const { transactions, kpi, budgets, byCategory } = await loadDashboardData(this.household.id);
        this.transactions = transactions;
        this.kpi = kpi;
        this.budgets = budgets;
        this.byCategoryExpense = byCategory;
        const inputs = {};
        this.budgetProgress.forEach(b => { inputs[b.category] = budgets[b.category] || ""; });
        this.budgetInputs = inputs;
      } catch {
        this.dashboardError = "Data dashboard belum bisa dimuat. Periksa koneksi API lalu coba lagi.";
      } finally {
        this.dashboardLoading = false;
      }
    },

    // =========================================================
    // BUDGET VS REALISASI
    // =========================================================
    async saveBudget(category) {
      const rawAmount = this.budgetInputs[category];
      const amount = rawAmount === "" || rawAmount === null || rawAmount === undefined ? 0 : parseFloat(rawAmount);
      if (!Number.isFinite(amount) || amount < 0) {
        this.budgetStatusMsg = "Budget harus berupa angka positif.";
        setTimeout(() => { this.budgetStatusMsg = ""; }, 2600);
        return;
      }
      this.budgetSavingCategory = category;
      this.budgetStatusMsg = "";
      try {
        await setBudget(this.household.id, category, amount);
        this.budgets = { ...this.budgets, [category]: amount };
        this.budgetStatusMsg = "Budget tersimpan.";
        setTimeout(() => { this.budgetStatusMsg = ""; }, 2200);
      } catch (err) {
        this.budgetStatusMsg = "Budget belum tersimpan. Coba lagi sebentar.";
      } finally {
        this.budgetSavingCategory = null;
      }
    },

    // =========================================================
    // EXPORT CSV
    // =========================================================
    async exportCSV() {
      this.exportLoading = true;
      try {
        await exportMonthCSV(monthKey(todayStr()));
      } catch (err) {
        alert("Gagal export data: " + err.message);
      } finally {
        this.exportLoading = false;
      }
    },

    // =========================================================
    // LANGGANAN & PEMBAYARAN
    // =========================================================
    async upgradePlan(planId) {
      this.payingPlan = planId;
      try {
        const { redirectUrl } = await createPayment(planId);
        window.location.href = redirectUrl;
      } catch (err) {
        alert("Gagal memulai pembayaran: " + err.message);
        this.payingPlan = null;
      }
    },

    // Dipanggil saat balik dari halaman pembayaran Midtrans. Webhook Midtrans
    // biasanya masuk beberapa detik setelah bayar, jadi di-poll, bukan sekali cek.
    async pollPaymentStatus(orderId) {
      this.paymentPolling = true;
      this.paymentStatusMsg = "Memeriksa status pembayaran...";

      const maxAttempts = 20;
      for (let i = 0; i < maxAttempts; i++) {
        try {
          const payment = await getPaymentStatus(orderId);
          if (payment.status === "paid") {
            this.paymentStatusMsg = "Pembayaran berhasil! Langganan Anda sudah aktif.";
            this.paymentPolling = false;
            await this.enterAppFor(this.currentUser);
            return;
          }
          if (payment.status === "failed") {
            this.paymentStatusMsg = "Pembayaran gagal atau dibatalkan.";
            this.paymentPolling = false;
            return;
          }
        } catch {
          // lanjut coba lagi
        }
        await new Promise(r => setTimeout(r, 3000));
      }

      this.paymentPolling = false;
      this.paymentStatusMsg = "Status pembayaran belum diketahui. Cek kembali beberapa saat lagi.";
    },

    // =========================================================
    // MODAL TAMBAH TRANSAKSI
    // =========================================================
    openModal() {
      if (this.subscriptionExpired) {
        alert("Langganan Anda telah berakhir. Perpanjang dulu di halaman Akun untuk menambah transaksi baru.");
        return;
      }
      this.setTxType("expense");
      this.txDate = todayStr();
      this.txAmount = "";
      this.txNote = "";
      this.modalOpen = true;
    },

    setTxType(type) {
      this.txType = type;
      this.txCategory = this.currentCategories[0]?.name || "";
    },

    quickSetCategory(name) {
      this.txCategory = name;
    },

    async submitTransaction() {
      if (this.subscriptionExpired) {
        alert("Langganan Anda telah berakhir. Perpanjang dulu di halaman Akun untuk menambah transaksi baru.");
        return;
      }
      const amount = parseFloat(this.txAmount);
      if (!this.txDate || !amount || amount <= 0) return;

      try {
        await addTransaction({
          householdId: this.household.id,
          userId: this.currentUser.id,
          date: this.txDate,
          type: this.txType,
          category: this.txCategory,
          amount,
          note: this.txNote
        });
        this.modalOpen = false;
        await this.refreshDashboard();
      } catch (err) {
        alert("Gagal menyimpan transaksi: " + err.message);
      }
    }
  };
}

window.appState = appState;

Alpine.start();
