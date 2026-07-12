import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BellRing,
  BrainCircuit,
  Building2,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Database,
  Gem,
  History,
  KeyRound,
  Landmark,
  Mail,
  MessageCircle,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  UserCog,
  Users,
  WalletCards
} from "lucide-react";
import {
  getAdminAuditLogs,
  getAdminHouseholds,
  getAdminOverview,
  getAdminPayments,
  getAdminSettings,
  getAdminUsers,
  updateAdminSetting,
  updateAdminUserRole,
  testApeEpiConnection
} from "../api/admin.js";
import { fmtRp } from "../utils/format.js";

const tabs = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "integrations", label: "Integrasi", icon: Database },
  { id: "data", label: "Data", icon: Users },
  { id: "audit", label: "Audit", icon: History }
];

const toneMap = {
  violet: {
    icon: "bg-violet-light text-violet",
    badge: "bg-violet-light text-violet",
    line: "bg-violet"
  },
  mint: {
    icon: "bg-mint-light text-mint",
    badge: "bg-mint-light text-mint",
    line: "bg-mint"
  },
  gold: {
    icon: "bg-gold-light/75 text-gold",
    badge: "bg-gold-light/75 text-gold",
    line: "bg-gold"
  },
  navy: {
    icon: "bg-navy text-white",
    badge: "bg-navy text-white",
    line: "bg-navy"
  },
  coral: {
    icon: "bg-coral-light text-coral",
    badge: "bg-coral-light text-coral",
    line: "bg-coral"
  }
};

const inputClass =
  "h-11 w-full rounded-2xl border border-neutral-border bg-white px-3 text-sm font-semibold text-navy shadow-[inset_0_1px_2px_rgba(15,31,61,0.06)] outline-none transition placeholder:text-neutral-400 focus:border-violet focus:shadow-[0_0_0_4px_rgba(111,85,242,0.12),inset_0_1px_2px_rgba(15,31,61,0.04)]";
const areaClass =
  "min-h-24 w-full rounded-2xl border border-neutral-border bg-white px-3 py-2 text-sm font-semibold text-navy shadow-[inset_0_1px_2px_rgba(15,31,61,0.06)] outline-none transition placeholder:text-neutral-400 focus:border-violet focus:shadow-[0_0_0_4px_rgba(111,85,242,0.12),inset_0_1px_2px_rgba(15,31,61,0.04)]";
const labelClass = "mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-neutral-500";

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`group relative flex h-9 w-[74px] flex-shrink-0 items-center rounded-full border px-1 outline-none transition-all duration-300 ease-out focus:shadow-[0_0_0_4px_rgba(111,85,242,0.14)] active:scale-[0.98] ${
        checked
          ? "border-mint bg-mint shadow-[0_12px_24px_rgba(24,197,148,0.22)]"
          : "border-neutral-border bg-white/90 shadow-[inset_0_1px_2px_rgba(15,31,61,0.08)] hover:border-violet/40"
      }`}
      aria-pressed={checked}
      aria-label={checked ? "Status aktif" : "Status nonaktif"}
    >
      <span
        className={`absolute text-[9px] font-black uppercase tracking-wide transition-all duration-300 ${
          checked ? "left-2.5 text-white opacity-100" : "left-3 text-neutral-400 opacity-100"
        }`}
      >
        {checked ? "ON" : "OFF"}
      </span>
      <span
        className={`absolute top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-soft transition-all duration-300 ease-out ${
          checked ? "translate-x-[39px]" : "translate-x-0"
        }`}
      >
        <span className={`h-2.5 w-2.5 rounded-full transition-colors duration-300 ${checked ? "bg-mint" : "bg-neutral-300"}`} />
      </span>
    </button>
  );
}

function StatusBadge({ children, tone = "violet" }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${toneMap[tone].badge}`}>
      {children}
    </span>
  );
}

function SectionTitle({ icon: Icon, title, subtitle, tone = "violet", action }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl ${toneMap[tone].icon}`}>
          <Icon size={17} />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold text-navy">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs font-medium leading-relaxed text-neutral-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone = "violet" }) {
  return (
    <div className="gloss-panel min-h-[116px] rounded-2xl p-4">
      <div className="relative z-10 flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${toneMap[tone].icon}`}>
            <Icon size={17} />
          </div>
          <div className={`h-1.5 w-8 rounded-full ${toneMap[tone].line}`} />
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">{label}</div>
          <div className="mt-1 truncate text-xl font-bold text-navy">{value}</div>
        </div>
      </div>
    </div>
  );
}

function SecretHint({ configured }) {
  return (
    <div className={`mt-1.5 flex items-center gap-1.5 text-[11px] font-bold ${configured ? "text-mint" : "text-neutral-500"}`}>
      {configured ? <CheckCircle2 size={12} /> : <KeyRound size={12} />}
      {configured ? "Secret tersimpan. Biarkan kosong jika tidak diganti." : "Secret belum tersimpan."}
    </div>
  );
}

function IntegrationCard({ icon: Icon, title, description, tone = "violet", enabled, onToggle, children, footer }) {
  return (
    <section className="gloss-panel rounded-2xl p-4">
      <SectionTitle
        icon={Icon}
        title={title}
        subtitle={description}
        tone={tone}
        action={<Toggle checked={Boolean(enabled)} onChange={onToggle} />}
      />
      <div className="relative z-10 space-y-3">{children}</div>
      {footer && <div className="relative z-10 mt-3">{footer}</div>}
    </section>
  );
}

function SaveButton({ label, saving, onClick, tone = "violet" }) {
  const bg = tone === "mint" ? "bg-mint" : tone === "gold" ? "bg-gold" : tone === "navy" ? "bg-navy" : "bg-violet";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      className={`flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-full px-4 text-sm font-bold text-white shadow-soft transition active:scale-[0.98] disabled:opacity-60 sm:w-auto ${bg}`}
    >
      <Save size={15} />
      {saving ? "Menyimpan..." : label}
    </button>
  );
}

function FormRow({ children }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function useFormState(value) {
  const [form, setForm] = useState(value || {});
  useEffect(() => setForm(value || {}), [value]);
  const set = (key, next) => setForm((prev) => ({ ...prev, [key]: next }));
  return [form, set, setForm];
}

function paymentTone(status) {
  if (status === "paid") return "mint";
  if (status === "failed") return "coral";
  return "gold";
}

function formatFetchedAt(value) {
  if (!value) return "Belum ada waktu pengambilan";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AdminPage({ user }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [overview, setOverview] = useState(null);
  const [settings, setSettings] = useState(null);
  const [users, setUsers] = useState([]);
  const [households, setHouseholds] = useState([]);
  const [payments, setPayments] = useState([]);
  const [logs, setLogs] = useState([]);
  const [userQuery, setUserQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [message, setMessage] = useState("");

  const [mailketing, setMailketing] = useFormState(settings?.mailketing);
  const [midtrans, setMidtrans] = useFormState(settings?.midtrans);
  const [manualPayment, setManualPayment] = useFormState(settings?.manual_payment);
  const [ai, setAi] = useFormState(settings?.ai);
  const [aiQuota, setAiQuota] = useFormState(settings?.ai_quota);
  const [apeEpi, setApeEpi] = useFormState(settings?.ape_epi);
  const [webPush, setWebPush] = useFormState(settings?.web_push);
  const [telegram, setTelegram] = useFormState(settings?.telegram);
  const [apePreview, setApePreview] = useState(null);
  const [apeTestStatus, setApeTestStatus] = useState(null);

  const canManageRoles = user?.role === "super_admin";

  async function loadAll() {
    setLoading(true);
    setMessage("");
    try {
      const [overviewData, settingsData, usersData, householdsData, paymentsData, logsData] = await Promise.all([
        getAdminOverview(),
        getAdminSettings(),
        getAdminUsers(userQuery),
        getAdminHouseholds(),
        getAdminPayments(),
        getAdminAuditLogs()
      ]);
      setOverview(overviewData);
      setSettings(settingsData);
      setUsers(usersData);
      setHouseholds(householdsData);
      setPayments(paymentsData);
      setLogs(logsData);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveSetting(key, form) {
    setSavingKey(key);
    setMessage("");
    try {
      const updated = await updateAdminSetting(key, form);
      setSettings((prev) => ({ ...prev, [key]: updated }));
      setMessage("Pengaturan tersimpan.");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSavingKey("");
    }
  }

  async function searchUsers(e) {
    e.preventDefault();
    try {
      setUsers(await getAdminUsers(userQuery));
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function changeRole(id, role) {
    try {
      await updateAdminUserRole(id, role);
      setUsers(await getAdminUsers(userQuery));
      setMessage("Role user diperbarui.");
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function testApeEpi() {
    setSavingKey("ape_epi_test");
    setMessage("");
    setApeTestStatus(null);
    try {
      const prices = await testApeEpiConnection();
      const hasValidPrices = prices?.enabled
        && Number(prices.gold?.price_per_gram || 0) > 0
        && Number(prices.silver?.price_per_gram || 0) > 0;
      setApePreview(hasValidPrices ? prices : null);
      setApeTestStatus({
        tone: hasValidPrices ? "success" : "warning",
        text: hasValidPrices
          ? "Koneksi APE-EPI berhasil. Harga terbaru berhasil dibaca."
          : prices?.error || "Koneksi berhasil, tetapi harga GOLDGRAM/SILVERGRAM 1 gram belum terbaca valid.",
      });
      setMessage(hasValidPrices ? "Koneksi APE-EPI berhasil." : "Harga APE-EPI belum terbaca valid.");
    } catch (err) {
      setApePreview(null);
      setApeTestStatus({
        tone: "error",
        text: err.message || "Koneksi APE-EPI gagal. Periksa API key, base URL, dan akses jaringan server.",
      });
      setMessage(err.message);
    } finally {
      setSavingKey("");
    }
  }

  const paymentSummary = useMemo(() => {
    const paid = payments.filter((p) => p.status === "paid").length;
    const pending = payments.filter((p) => p.status === "pending").length;
    return { paid, pending };
  }, [payments]);

  const activeTabLabel = tabs.find((tab) => tab.id === activeTab)?.label || "Overview";

  return (
    <main className="mx-auto max-w-6xl px-4 pb-28 sm:px-5">
      <section className="gloss-panel mb-4 rounded-[28px] p-4 sm:p-5">
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <img
              src="/images/fine-pro-header.jpg"
              alt="FinePro"
              className="mb-3 h-9 w-auto max-w-[190px] rounded-xl object-contain sm:h-10"
            />
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-violet-light px-3 py-1 text-[11px] font-bold text-violet">
              <ShieldCheck size={13} />
              Admin Console
            </div>
            <h1 className="text-2xl font-bold leading-tight text-navy sm:text-3xl">Pengaturan Sistem FinePro</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-neutral-500">
              Kelola integrasi, pengguna, pembayaran, dan jejak aktivitas dari satu ruang kerja yang ringkas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge tone={canManageRoles ? "mint" : "violet"}>{user?.role || "admin"}</StatusBadge>
            <button
              type="button"
              onClick={loadAll}
              className="gloss-button flex h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold text-violet"
              title="Refresh"
            >
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </section>

      {message && (
        <div className="gloss-panel mb-4 rounded-2xl p-3 text-sm font-bold text-navy">
          {message}
        </div>
      )}

      <div className="sticky top-[73px] z-10 mb-4 -mx-4 border-y border-white/70 bg-white/55 px-4 py-2 backdrop-blur-xl sm:mx-0 sm:rounded-3xl sm:border">
        <div className="grid grid-cols-4 gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl px-2 text-xs font-bold transition active:scale-[0.98] sm:text-sm ${
                  active ? "bg-navy text-white shadow-soft" : "text-neutral-500 hover:bg-white/70 hover:text-violet"
                }`}
              >
                <Icon size={16} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
        <span>{activeTabLabel}</span>
        <ChevronRight size={13} />
        <span className="text-violet">{loading ? "Memuat" : "Siap"}</span>
      </div>

      {activeTab === "overview" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total User" value={overview?.users ?? "-"} icon={Users} tone="violet" />
          <StatCard label="Household" value={overview?.households ?? "-"} icon={Building2} tone="mint" />
          <StatCard label="Transaksi Bulan Ini" value={overview?.monthlyTransactions ?? "-"} icon={Activity} tone="gold" />
          <StatCard label="Revenue Paid" value={fmtRp(overview?.revenue || 0)} icon={CreditCard} tone="navy" />
          <StatCard label="Subscription Aktif" value={overview?.subscriptions?.active ?? "-"} icon={ShieldCheck} tone="mint" />
          <StatCard label="Subscription Expired" value={overview?.subscriptions?.expired ?? "-"} icon={History} tone="coral" />
          <StatCard label="Payment Paid" value={paymentSummary.paid} icon={WalletCards} tone="violet" />
          <StatCard label="Payment Pending" value={paymentSummary.pending} icon={CreditCard} tone="gold" />
        </div>
      )}

      {activeTab === "integrations" && settings && (
        <div className="grid gap-4 lg:grid-cols-2">
          <IntegrationCard
            icon={Mail}
            title="Mailketing"
            description="Email reset password dan laporan bulanan."
            tone="violet"
            enabled={mailketing.enabled}
            onToggle={(v) => setMailketing("enabled", v)}
            footer={
              <SaveButton label="Simpan Mailketing" saving={savingKey === "mailketing"} onClick={() => saveSetting("mailketing", mailketing)} />
            }
          >
            <div>
              <label className={labelClass}>API Token</label>
              <input className={inputClass} type="password" value={mailketing.api_token || ""} onChange={(e) => setMailketing("api_token", e.target.value)} placeholder={mailketing.api_token_masked || "Token baru"} />
              <SecretHint configured={mailketing.api_token_configured} />
            </div>
            <FormRow>
              <div>
                <label className={labelClass}>From Email</label>
                <input className={inputClass} value={mailketing.from_email || ""} onChange={(e) => setMailketing("from_email", e.target.value)} placeholder="email@domain.com" />
              </div>
              <div>
                <label className={labelClass}>From Name</label>
                <input className={inputClass} value={mailketing.from_name || ""} onChange={(e) => setMailketing("from_name", e.target.value)} placeholder="Finepro" />
              </div>
            </FormRow>
          </IntegrationCard>

          <IntegrationCard
            icon={CreditCard}
            title="Midtrans"
            description="Payment gateway untuk upgrade paket."
            tone="navy"
            enabled={midtrans.enabled}
            onToggle={(v) => setMidtrans("enabled", v)}
            footer={
              <SaveButton label="Simpan Midtrans" saving={savingKey === "midtrans"} onClick={() => saveSetting("midtrans", midtrans)} tone="navy" />
            }
          >
            <div className="flex items-center justify-between rounded-2xl border border-neutral-border/70 bg-white/65 px-3 py-2">
              <span className="text-sm font-bold text-navy">Production Mode</span>
              <Toggle checked={Boolean(midtrans.is_production)} onChange={(v) => setMidtrans("is_production", v)} />
            </div>
            <div>
              <label className={labelClass}>Server Key</label>
              <input className={inputClass} type="password" value={midtrans.server_key || ""} onChange={(e) => setMidtrans("server_key", e.target.value)} placeholder={midtrans.server_key_masked || "Server key baru"} />
              <SecretHint configured={midtrans.server_key_configured} />
            </div>
            <div>
              <label className={labelClass}>Client Key</label>
              <input className={inputClass} type="password" value={midtrans.client_key || ""} onChange={(e) => setMidtrans("client_key", e.target.value)} placeholder={midtrans.client_key_masked || "Client key baru"} />
              <SecretHint configured={midtrans.client_key_configured} />
            </div>
          </IntegrationCard>

          <IntegrationCard
            icon={Landmark}
            title="Transfer Manual"
            description="Rekening alternatif untuk pembayaran."
            tone="gold"
            enabled={manualPayment.enabled}
            onToggle={(v) => setManualPayment("enabled", v)}
            footer={
              <SaveButton label="Simpan Transfer" saving={savingKey === "manual_payment"} onClick={() => saveSetting("manual_payment", manualPayment)} tone="gold" />
            }
          >
            <FormRow>
              <div>
                <label className={labelClass}>Bank</label>
                <input className={inputClass} value={manualPayment.bank_name || ""} onChange={(e) => setManualPayment("bank_name", e.target.value)} placeholder="BCA" />
              </div>
              <div>
                <label className={labelClass}>Nomor Rekening</label>
                <input className={inputClass} value={manualPayment.account_number || ""} onChange={(e) => setManualPayment("account_number", e.target.value)} placeholder="1234567890" />
              </div>
            </FormRow>
            <div>
              <label className={labelClass}>Nama Rekening</label>
              <input className={inputClass} value={manualPayment.account_name || ""} onChange={(e) => setManualPayment("account_name", e.target.value)} placeholder="PT / Nama Pemilik" />
            </div>
            <div>
              <label className={labelClass}>Instruksi</label>
              <textarea className={areaClass} value={manualPayment.instructions || ""} onChange={(e) => setManualPayment("instructions", e.target.value)} placeholder="Transfer sesuai nominal, lalu konfirmasi ke admin." />
            </div>
          </IntegrationCard>

          <IntegrationCard
            icon={BrainCircuit}
            title="API AI"
            description="Insight keuangan dan pemrosesan struk."
            tone="mint"
            enabled={ai.enabled}
            onToggle={(v) => setAi("enabled", v)}
            footer={<SaveButton label="Simpan AI" saving={savingKey === "ai"} onClick={() => saveSetting("ai", ai)} tone="mint" />}
          >
            <FormRow>
              <div>
                <label className={labelClass}>Provider</label>
                <select className={inputClass} value={ai.provider || "sumopod"} onChange={(e) => setAi("provider", e.target.value)}>
                  <option value="sumopod">SumoPod AI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Model SumoPod</label>
                <input className={inputClass} value={ai.sumopod_model || ai.model || ""} onChange={(e) => setAi("sumopod_model", e.target.value)} placeholder="gpt-4o-mini" />
              </div>
            </FormRow>
            <div>
              <label className={labelClass}>SumoPod API Key</label>
              <input className={inputClass} type="password" value={ai.sumopod_api_key || ""} onChange={(e) => setAi("sumopod_api_key", e.target.value)} placeholder={ai.sumopod_api_key_masked || "API key baru"} />
              <SecretHint configured={ai.sumopod_api_key_configured} />
            </div>
            <FormRow>
              <div>
                <label className={labelClass}>Base URL SumoPod</label>
                <input className={inputClass} value={ai.sumopod_base_url || ""} onChange={(e) => setAi("sumopod_base_url", e.target.value)} placeholder="https://ai.sumopod.com/v1" />
              </div>
              <div>
                <label className={labelClass}>Model Anthropic</label>
                <input className={inputClass} value={ai.anthropic_model || ai.model || ""} onChange={(e) => setAi("anthropic_model", e.target.value)} placeholder="claude-sonnet-4-5" />
              </div>
            </FormRow>
            <div>
              <label className={labelClass}>Anthropic API Key</label>
              <input className={inputClass} type="password" value={ai.anthropic_api_key || ""} onChange={(e) => setAi("anthropic_api_key", e.target.value)} placeholder={ai.anthropic_api_key_masked || "API key baru"} />
              <SecretHint configured={ai.anthropic_api_key_configured} />
            </div>
          </IntegrationCard>

          <section className="gloss-panel rounded-2xl p-4">
            <SectionTitle
              icon={BrainCircuit}
              title="Limit AI per Tier"
              subtitle="Mengatur kuota gabungan web dan Telegram berdasarkan paket pengguna."
              tone="mint"
            />
            <div className="relative z-10 space-y-4">
              <div className="rounded-2xl border border-mint/15 bg-mint-light/70 p-3">
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-mint">Trial</div>
                <FormRow>
                  <div>
                    <label className={labelClass}>Insight total trial</label>
                    <input className={inputClass} type="number" min="0" value={aiQuota.trial_insight_total ?? 3} onChange={(e) => setAiQuota("trial_insight_total", Number(e.target.value))} />
                  </div>
                  <div>
                    <label className={labelClass}>Scan total trial</label>
                    <input className={inputClass} type="number" min="0" value={aiQuota.trial_scan_total ?? 5} onChange={(e) => setAiQuota("trial_scan_total", Number(e.target.value))} />
                  </div>
                </FormRow>
              </div>

              <div className="rounded-2xl border border-neutral-border/70 bg-white/65 p-3">
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">Free / Expired</div>
                <FormRow>
                  <div>
                    <label className={labelClass}>Insight / Bulan</label>
                    <input className={inputClass} type="number" min="0" value={aiQuota.free_insight_monthly ?? 1} onChange={(e) => setAiQuota("free_insight_monthly", Number(e.target.value))} />
                  </div>
                  <div>
                    <label className={labelClass}>Scan / Bulan</label>
                    <input className={inputClass} type="number" min="0" value={aiQuota.free_scan_monthly ?? 3} onChange={(e) => setAiQuota("free_scan_monthly", Number(e.target.value))} />
                  </div>
                </FormRow>
              </div>

              <div className="rounded-2xl border border-violet/15 bg-violet-light/60 p-3">
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-violet">Paid: Monthly / 6 Bulan / Annual</div>
                <FormRow>
                  <div>
                    <label className={labelClass}>Insight / Hari</label>
                    <input className={inputClass} type="number" min="0" value={aiQuota.paid_insight_daily ?? 3} onChange={(e) => setAiQuota("paid_insight_daily", Number(e.target.value))} />
                  </div>
                  <div>
                    <label className={labelClass}>Scan / Bulan</label>
                    <input className={inputClass} type="number" min="0" value={aiQuota.paid_scan_monthly ?? 30} onChange={(e) => setAiQuota("paid_scan_monthly", Number(e.target.value))} />
                  </div>
                </FormRow>
              </div>

              <div className="rounded-2xl bg-white/60 px-3 py-2 text-xs font-semibold leading-relaxed text-neutral-500">
                Scan otomatis dihitung gabungan dari web, upload file, kamera, dan Telegram. Insight dihitung dari tombol Analisa Keuangan.
              </div>

              <SaveButton label="Simpan Limit Tier" saving={savingKey === "ai_quota"} onClick={() => saveSetting("ai_quota", aiQuota)} tone="mint" />
            </div>
          </section>

          <IntegrationCard
            icon={Gem}
            title="APE-EPI Auto Price Engine"
            description="Harga per gram GOLDGRAM dan SILVERGRAM untuk valuasi target aset."
            tone="gold"
            enabled={apeEpi.enabled}
            onToggle={(v) => setApeEpi("enabled", v)}
            footer={
              <div className="flex flex-col gap-2 sm:flex-row">
                <SaveButton label="Simpan APE-EPI" saving={savingKey === "ape_epi"} onClick={() => saveSetting("ape_epi", apeEpi)} tone="gold" />
                <button
                  type="button"
                  onClick={testApeEpi}
                  disabled={savingKey === "ape_epi_test"}
                  className="flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-full bg-white px-4 text-sm font-bold text-violet shadow-soft transition active:scale-[0.98] disabled:opacity-60 sm:w-auto"
                >
                  <RefreshCw size={15} className={savingKey === "ape_epi_test" ? "animate-spin" : ""} />
                  {savingKey === "ape_epi_test" ? "Menguji..." : "Test Koneksi"}
                </button>
              </div>
            }
          >
            <div>
              <label className={labelClass}>API Key</label>
              <input className={inputClass} type="password" value={apeEpi.api_key || ""} onChange={(e) => setApeEpi("api_key", e.target.value)} placeholder={apeEpi.api_key_masked || "API key APE-EPI"} />
              <SecretHint configured={apeEpi.api_key_configured} />
            </div>
            <div>
              <label className={labelClass}>Base URL</label>
              <input className={inputClass} value={apeEpi.base_url || ""} onChange={(e) => setApeEpi("base_url", e.target.value)} placeholder="https://ape.bisnisemasperak.com/api/v1" />
            </div>
            <FormRow>
              <div>
                <label className={labelClass}>Brand Emas</label>
                <input className={inputClass} value={apeEpi.gold_brand || "GOLDGRAM"} onChange={(e) => setApeEpi("gold_brand", e.target.value)} placeholder="GOLDGRAM" />
              </div>
              <div>
                <label className={labelClass}>Brand Perak</label>
                <input className={inputClass} value={apeEpi.silver_brand || "SILVERGRAM"} onChange={(e) => setApeEpi("silver_brand", e.target.value)} placeholder="SILVERGRAM" />
              </div>
            </FormRow>
            <FormRow>
              <div>
                <label className={labelClass}>Level Harga</label>
                <input className={inputClass} value={apeEpi.level || "konsumen"} onChange={(e) => setApeEpi("level", e.target.value)} placeholder="konsumen" />
              </div>
              <div>
                <label className={labelClass}>Cache TTL Menit</label>
                <input className={inputClass} type="number" min="1" value={apeEpi.cache_ttl_minutes ?? 30} onChange={(e) => setApeEpi("cache_ttl_minutes", Number(e.target.value))} />
              </div>
            </FormRow>
            <div>
              <label className={labelClass}>Maksimal Request Harga Baru / Hari</label>
              <input className={inputClass} type="number" min="1" value={apeEpi.max_daily_requests ?? 3} onChange={(e) => setApeEpi("max_daily_requests", Number(e.target.value))} />
              <div className="mt-1.5 text-[11px] font-semibold leading-relaxed text-neutral-500">
                Rekomendasi FinePro: 3x per hari karena harga EPI biasanya update setelah jam 09:00.
              </div>
            </div>
            {apeTestStatus && (
              <div
                className={`rounded-2xl border px-3 py-2 text-xs font-bold leading-relaxed ${
                  apeTestStatus.tone === "success"
                    ? "border-mint/20 bg-mint-light/80 text-mint"
                    : apeTestStatus.tone === "warning"
                    ? "border-gold/20 bg-gold-light/80 text-gold"
                    : "border-coral/20 bg-coral-light/80 text-coral"
                }`}
              >
                {apeTestStatus.text}
              </div>
            )}
            {apePreview?.enabled && Number(apePreview.gold?.price_per_gram || 0) > 0 && Number(apePreview.silver?.price_per_gram || 0) > 0 && (
              <div className="grid gap-2 rounded-2xl border border-gold/20 bg-gold-light/60 p-3 sm:grid-cols-2">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-gold">GOLDGRAM</div>
                  <div className="mt-1 text-sm font-bold text-navy">{fmtRp(Number(apePreview.gold?.price_per_gram || 0))} / gram</div>
                  <div className="text-[11px] font-semibold text-neutral-500">Diambil {formatFetchedAt(apePreview.gold?.fetched_at)}</div>
                  {apePreview.gold?.date && <div className="text-[10px] font-semibold text-neutral-400">Tanggal harga {apePreview.gold.date}</div>}
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-violet">SILVERGRAM</div>
                  <div className="mt-1 text-sm font-bold text-navy">{fmtRp(Number(apePreview.silver?.price_per_gram || 0))} / gram</div>
                  <div className="text-[11px] font-semibold text-neutral-500">Diambil {formatFetchedAt(apePreview.silver?.fetched_at)}</div>
                  {apePreview.silver?.date && <div className="text-[10px] font-semibold text-neutral-400">Tanggal harga {apePreview.silver.date}</div>}
                </div>
              </div>
            )}
          </IntegrationCard>

          <IntegrationCard
            icon={BellRing}
            title="Web Push"
            description="Notifikasi budget untuk pengguna."
            tone="gold"
            enabled={webPush.enabled}
            onToggle={(v) => setWebPush("enabled", v)}
            footer={<SaveButton label="Simpan Web Push" saving={savingKey === "web_push"} onClick={() => saveSetting("web_push", webPush)} tone="gold" />}
          >
            <div>
              <label className={labelClass}>VAPID Public Key</label>
              <input className={inputClass} value={webPush.vapid_public_key || ""} onChange={(e) => setWebPush("vapid_public_key", e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>VAPID Private Key</label>
              <input className={inputClass} type="password" value={webPush.vapid_private_key || ""} onChange={(e) => setWebPush("vapid_private_key", e.target.value)} placeholder={webPush.vapid_private_key_masked || "Private key baru"} />
              <SecretHint configured={webPush.vapid_private_key_configured} />
            </div>
            <div>
              <label className={labelClass}>VAPID Subject</label>
              <input className={inputClass} value={webPush.vapid_subject || ""} onChange={(e) => setWebPush("vapid_subject", e.target.value)} placeholder="mailto:admin@finepro.my.id" />
            </div>
          </IntegrationCard>

          <IntegrationCard
            icon={MessageCircle}
            title="Telegram"
            description="Bot Telegram dan workflow n8n."
            tone="violet"
            enabled={telegram.enabled}
            onToggle={(v) => setTelegram("enabled", v)}
            footer={<SaveButton label="Simpan Telegram" saving={savingKey === "telegram"} onClick={() => saveSetting("telegram", telegram)} />}
          >
            <div>
              <label className={labelClass}>Bot Token</label>
              <input className={inputClass} type="password" value={telegram.bot_token || ""} onChange={(e) => setTelegram("bot_token", e.target.value)} placeholder={telegram.bot_token_masked || "123456:ABC-DEF..."} />
              <SecretHint configured={telegram.bot_token_configured} />
            </div>
            <FormRow>
              <div>
                <label className={labelClass}>Username Bot</label>
                <input className={inputClass} value={telegram.bot_username || ""} onChange={(e) => setTelegram("bot_username", e.target.value)} placeholder="finepro_bot" />
              </div>
              <div>
                <label className={labelClass}>Shared Secret n8n</label>
                <input className={inputClass} type="password" value={telegram.n8n_shared_secret || ""} onChange={(e) => setTelegram("n8n_shared_secret", e.target.value)} placeholder={telegram.n8n_shared_secret_masked || "Secret acak"} />
                <SecretHint configured={telegram.n8n_shared_secret_configured} />
              </div>
            </FormRow>
          </IntegrationCard>
        </div>
      )}

      {activeTab === "data" && (
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="gloss-panel rounded-2xl p-4">
            <SectionTitle
              icon={UserCog}
              title="Users"
              subtitle={`${users.length} akun ditampilkan`}
              tone="violet"
              action={
                <form onSubmit={searchUsers} className="flex min-w-0 gap-2">
                  <input className="h-10 min-w-0 rounded-full border border-neutral-border bg-white px-3 text-sm font-semibold text-navy outline-none" value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="Cari user" />
                  <button className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-violet text-white" type="submit" title="Cari">
                    <Search size={15} />
                  </button>
                </form>
              }
            />
            <div className="relative z-10 max-h-[560px] overflow-y-auto">
              {users.map((u) => (
                <div key={u.id} className="grid gap-2 border-b border-neutral-border/60 py-3 last:border-0 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-navy">{u.name || u.email}</div>
                    <div className="truncate text-xs font-medium text-neutral-500">{u.email}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <StatusBadge tone={u.effective_role === "super_admin" ? "navy" : u.effective_role === "admin" ? "violet" : "mint"}>
                        {u.effective_role || u.role}
                      </StatusBadge>
                      <StatusBadge tone="gold">{u.household_name || "Tanpa household"}</StatusBadge>
                    </div>
                  </div>
                  {canManageRoles && (
                    <select className={`${inputClass} sm:w-44`} value={u.role} onChange={(e) => changeRole(u.id, e.target.value)}>
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                      <option value="super_admin">super_admin</option>
                    </select>
                  )}
                </div>
              ))}
              {users.length === 0 && <div className="py-8 text-center text-sm font-semibold text-neutral-500">Tidak ada user.</div>}
            </div>
          </section>

          <section className="gloss-panel rounded-2xl p-4">
            <SectionTitle icon={Building2} title="Households" subtitle={`${households.length} workspace aktif/tercatat`} tone="mint" />
            <div className="relative z-10 max-h-[560px] overflow-y-auto">
              {households.map((h) => (
                <div key={h.id} className="border-b border-neutral-border/60 py-3 last:border-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-navy">{h.name}</div>
                      <div className="truncate text-xs font-medium text-neutral-500">{h.owner_email}</div>
                    </div>
                    <StatusBadge tone={h.subscription_status === "active" ? "mint" : "gold"}>{h.subscription_status || "unknown"}</StatusBadge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <StatusBadge tone="violet">{h.household_type}</StatusBadge>
                    <StatusBadge tone="navy">{h.member_count} anggota</StatusBadge>
                    <StatusBadge tone="gold">{h.plan || "trial"}</StatusBadge>
                  </div>
                </div>
              ))}
              {households.length === 0 && <div className="py-8 text-center text-sm font-semibold text-neutral-500">Tidak ada household.</div>}
            </div>
          </section>

          <section className="gloss-panel rounded-2xl p-4 xl:col-span-2">
            <SectionTitle icon={WalletCards} title="Payments" subtitle={`${payments.length} transaksi pembayaran`} tone="gold" />
            <div className="relative z-10 grid gap-2 md:grid-cols-2">
              {payments.map((p) => (
                <div key={p.order_id} className="rounded-2xl border border-neutral-border/60 bg-white/65 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-navy">{p.household_name}</div>
                      <div className="truncate text-xs font-medium text-neutral-500">{p.owner_email}</div>
                    </div>
                    <StatusBadge tone={paymentTone(p.status)}>{p.status}</StatusBadge>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div className="text-xs font-bold uppercase tracking-wide text-neutral-500">{p.plan}</div>
                    <div className="text-sm font-bold text-navy">{fmtRp(p.amount)}</div>
                  </div>
                </div>
              ))}
              {payments.length === 0 && <div className="py-8 text-center text-sm font-semibold text-neutral-500 md:col-span-2">Belum ada payment.</div>}
            </div>
          </section>
        </div>
      )}

      {activeTab === "audit" && (
        <section className="gloss-panel rounded-2xl p-4">
          <SectionTitle icon={History} title="Audit Log" subtitle={`${logs.length} aktivitas terakhir`} tone="navy" />
          <div className="relative z-10">
            {logs.map((log) => (
              <div key={log.id} className="border-b border-neutral-border/60 py-3 last:border-0">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm font-bold text-navy">{log.action}</div>
                  <div className="text-xs font-semibold text-neutral-500">{new Date(log.created_at).toLocaleString("id-ID")}</div>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <StatusBadge tone="violet">{log.admin_email}</StatusBadge>
                  <StatusBadge tone="gold">{log.target_type || "-"}</StatusBadge>
                </div>
                {log.metadata && (
                  <pre className="mt-2 max-h-40 overflow-auto rounded-2xl border border-neutral-border/60 bg-white/70 p-3 text-[11px] font-semibold leading-relaxed text-neutral-700">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                )}
              </div>
            ))}
            {logs.length === 0 && <div className="py-8 text-center text-sm font-semibold text-neutral-500">Belum ada audit log.</div>}
          </div>
        </section>
      )}
    </main>
  );
}
