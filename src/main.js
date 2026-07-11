// src/main.js
// Entry point aplikasi. Alpine.js dipakai hanya sebagai lapisan reactivity
// tipis (bukan framework besar) — semua logika data/bisnis tetap hidup
// di src/lib dan src/pages, main.js hanya menyambungkannya ke UI.
//
// v1.1 — Migrasi dari Supabase ke PostgreSQL + Express.js API

import Alpine from "alpinejs";
import { registerSW } from "virtual:pwa-register";

import { signUp, signIn, signOut, getSession, translateAuthError } from "./lib/auth.js";
import { getMyHousehold, createHousehold, updateMonthlyIncomeDay, HOUSEHOLD_TYPE_LABELS } from "./lib/households.js";
import { getCategories } from "./lib/categories.js";
import { addTransaction, exportMonthCSV } from "./lib/transactions.js";
import { setBudget } from "./lib/budgets.js";
import { getSubscription, planLabel } from "./lib/subscriptions.js";
import { createInvite, getMyPendingInvites, acceptInvite } from "./lib/invites.js";
import { loadDashboardData } from "./pages/dashboard.js";
import { fmtRp, todayStr, monthKey, daysUntilMonthlyDay } from "./utils/format.js";
import { getToken } from "./lib/apiClient.js";

// Registrasi service worker otomatis (vite-plugin-pwa)
registerSW({ immediate: true });

function appState() {
  return {
    // ---- navigasi ----
    view: "loading", // loading | auth | onboarding | app
    page: "dashboard", // dashboard | account

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

    // ---- budget vs realisasi ----
    budgets: {},
    byCategoryExpense: {},
    budgetInputs: {},
    budgetSavingCategory: null,
    exportLoading: false,

    get budgetProgress() {
      return this.categoriesExpense.map(c => {
        const budget = this.budgets[c.name] || 0;
        const spent = this.byCategoryExpense[c.name] || 0;
        const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
        return { category: c.name, budget, spent, pct };
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

    // =========================================================
    // INIT — dipanggil sekali saat halaman dibuka
    // =========================================================
    async init() {
      const session = await getSession();
      if (session) {
        await this.enterAppFor(session.user);
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

      const [sub, catExpense, catIncome] = await Promise.all([
        getSubscription(this.household.id),
        getCategories(this.household.id, "expense"),
        getCategories(this.household.id, "income")
      ]);
      this.planLabel = planLabel(sub);
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
      const { transactions, kpi, budgets, byCategory } = await loadDashboardData(this.household.id);
      this.transactions = transactions;
      this.kpi = kpi;
      this.budgets = budgets;
      this.byCategoryExpense = byCategory;
      const inputs = {};
      Object.keys(budgets).forEach(cat => { inputs[cat] = budgets[cat]; });
      this.budgetInputs = inputs;
    },

    // =========================================================
    // BUDGET VS REALISASI
    // =========================================================
    async saveBudget(category) {
      const amount = parseFloat(this.budgetInputs[category]) || 0;
      this.budgetSavingCategory = category;
      try {
        await setBudget(this.household.id, category, amount);
        this.budgets = { ...this.budgets, [category]: amount };
      } catch (err) {
        alert("Gagal menyimpan budget: " + err.message);
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
    // MODAL TAMBAH TRANSAKSI
    // =========================================================
    openModal() {
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
