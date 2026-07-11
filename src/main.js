// src/main.js
// Entry point aplikasi. Alpine.js dipakai hanya sebagai lapisan reactivity
// tipis (bukan framework besar) — semua logika data/bisnis tetap hidup
// di src/lib dan src/pages, main.js hanya menyambungkannya ke UI.

import Alpine from "alpinejs";
import { registerSW } from "virtual:pwa-register";

import { supabase } from "./lib/supabaseClient.js";
import { signUp, signIn, signOut, getCurrentUser, getSession, translateAuthError } from "./lib/auth.js";
import { getMyHousehold, createHousehold, HOUSEHOLD_TYPE_LABELS } from "./lib/households.js";
import { getCategories } from "./lib/categories.js";
import { addTransaction } from "./lib/transactions.js";
import { getSubscription, planLabel } from "./lib/subscriptions.js";
import { loadDashboardData } from "./pages/dashboard.js";
import { fmtRp, todayStr } from "./utils/format.js";

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

    // ---- household/state utama ----
    currentUser: null,
    household: null,
    householdTypeLabel: "",
    planLabel: "Trial",

    // ---- dashboard ----
    kpi: { income: 0, expense: 0 },
    transactions: [],

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

      // Dengarkan perubahan auth (mis. setelah konfirmasi email di tab lain)
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === "SIGNED_OUT") {
          this.view = "auth";
        }
      });
    },

    // =========================================================
    // AUTH
    // =========================================================
    async submitAuth() {
      this.authLoading = true;
      this.authMsg = "";
      try {
        if (this.authMode === "signup") {
          const data = await signUp(this.authEmail, this.authPassword);
          if (data.user && !data.session) {
            this.authMsg = "Pendaftaran berhasil. Cek email untuk konfirmasi sebelum masuk.";
            this.authMsgType = "success";
            this.authLoading = false;
            return;
          }
          await this.enterAppFor(data.user);
        } else {
          const data = await signIn(this.authEmail, this.authPassword);
          await this.enterAppFor(data.user);
        }
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
    },

    // =========================================================
    // DASHBOARD
    // =========================================================
    async refreshDashboard() {
      const { transactions, kpi } = await loadDashboardData(this.household.id);
      this.transactions = transactions;
      this.kpi = kpi;
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
