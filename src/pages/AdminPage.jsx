import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  Building2,
  CreditCard,
  Database,
  History,
  Mail,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Smartphone,
  Users
} from "lucide-react";
import {
  getAdminAuditLogs,
  getAdminHouseholds,
  getAdminOverview,
  getAdminPayments,
  getAdminSettings,
  getAdminUsers,
  updateAdminSetting,
  updateAdminUserRole
} from "../api/admin.js";
import { fmtRp } from "../utils/format.js";

const tabs = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "integrations", label: "Integrasi", icon: Database },
  { id: "data", label: "Data", icon: Users },
  { id: "audit", label: "Audit", icon: History }
];

const inputClass = "h-10 w-full rounded-xl border border-neutral-border bg-white/75 px-3 text-sm font-medium text-navy outline-none";
const areaClass = "min-h-24 w-full rounded-xl border border-neutral-border bg-white/75 px-3 py-2 text-sm font-medium text-navy outline-none";
const labelClass = "mb-1 block text-xs font-medium text-neutral-500";

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 rounded-full transition-colors ${checked ? "bg-violet" : "bg-neutral-100"}`}
      aria-pressed={checked}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-soft transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="gloss-panel rounded-2xl p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-violet-light text-violet">
        <Icon size={17} />
      </div>
      <div className="text-xs font-medium text-neutral-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-navy">{value}</div>
    </div>
  );
}

function SecretHint({ configured }) {
  return (
    <div className={`mt-1 text-[11px] font-medium ${configured ? "text-mint" : "text-neutral-500"}`}>
      {configured ? "Secret sudah tersimpan. Kosongkan field jika tidak ingin mengganti." : "Belum ada secret tersimpan."}
    </div>
  );
}

function IntegrationCard({ icon: Icon, title, description, children }) {
  return (
    <div className="gloss-panel rounded-2xl p-4">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-violet-light text-violet">
          <Icon size={17} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-navy">{title}</h3>
          <p className="text-xs text-neutral-500">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function useFormState(value) {
  const [form, setForm] = useState(value || {});
  useEffect(() => setForm(value || {}), [value]);
  const set = (key, next) => setForm((prev) => ({ ...prev, [key]: next }));
  return [form, set, setForm];
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
  const [webPush, setWebPush] = useFormState(settings?.web_push);

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

  const paymentSummary = useMemo(() => {
    const paid = payments.filter((p) => p.status === "paid").length;
    const pending = payments.filter((p) => p.status === "pending").length;
    return { paid, pending };
  }, [payments]);

  return (
    <div className="mx-auto max-w-5xl px-5 pb-28">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-violet">
            <ShieldCheck size={15} />
            Admin Console
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-navy">Pengaturan Sistem</h1>
        </div>
        <button type="button" onClick={loadAll} className="gloss-button flex h-10 w-10 items-center justify-center rounded-full text-violet" title="Refresh">
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {message && (
        <div className="gloss-panel mb-4 rounded-2xl p-3 text-sm font-medium text-navy">
          {message}
        </div>
      )}

      <div className="mb-4 grid grid-cols-4 gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-medium ${
                activeTab === tab.id ? "bg-violet text-white shadow-soft" : "gloss-button text-neutral-500"
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total User" value={overview?.users ?? "-"} icon={Users} />
          <StatCard label="Household" value={overview?.households ?? "-"} icon={Building2} />
          <StatCard label="Transaksi Bulan Ini" value={overview?.monthlyTransactions ?? "-"} icon={Activity} />
          <StatCard label="Revenue Paid" value={fmtRp(overview?.revenue || 0)} icon={CreditCard} />
          <StatCard label="Subscription Aktif" value={overview?.subscriptions?.active ?? "-"} icon={ShieldCheck} />
          <StatCard label="Subscription Expired" value={overview?.subscriptions?.expired ?? "-"} icon={History} />
          <StatCard label="Payment Paid" value={paymentSummary.paid} icon={CreditCard} />
          <StatCard label="Payment Pending" value={paymentSummary.pending} icon={CreditCard} />
        </div>
      )}

      {activeTab === "integrations" && settings && (
        <div className="grid gap-4 lg:grid-cols-2">
          <IntegrationCard icon={Mail} title="Mailketing" description="Email laporan bulanan dan komunikasi operasional.">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-navy">Aktifkan Mailketing</span>
              <Toggle checked={Boolean(mailketing.enabled)} onChange={(v) => setMailketing("enabled", v)} />
            </div>
            <label className={labelClass}>API Token</label>
            <input className={inputClass} type="password" value={mailketing.api_token || ""} onChange={(e) => setMailketing("api_token", e.target.value)} placeholder={mailketing.api_token_masked || "Token baru"} />
            <SecretHint configured={mailketing.api_token_configured} />
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div>
                <label className={labelClass}>From Email</label>
                <input className={inputClass} value={mailketing.from_email || ""} onChange={(e) => setMailketing("from_email", e.target.value)} placeholder="email@domain.com" />
              </div>
              <div>
                <label className={labelClass}>From Name</label>
                <input className={inputClass} value={mailketing.from_name || ""} onChange={(e) => setMailketing("from_name", e.target.value)} placeholder="Admin Finepro" />
              </div>
            </div>
            <button type="button" onClick={() => saveSetting("mailketing", mailketing)} disabled={savingKey === "mailketing"} className="mt-3 flex h-10 items-center justify-center gap-1.5 rounded-full bg-violet px-4 text-sm font-semibold text-white disabled:opacity-60">
              <Save size={15} /> Simpan Mailketing
            </button>
          </IntegrationCard>

          <IntegrationCard icon={CreditCard} title="Midtrans" description="Payment gateway otomatis untuk paket langganan.">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-navy">Aktifkan Midtrans</span>
              <Toggle checked={Boolean(midtrans.enabled)} onChange={(v) => setMidtrans("enabled", v)} />
            </div>
            <div className="mb-3 flex items-center justify-between rounded-xl bg-white/60 px-3 py-2">
              <span className="text-sm font-medium text-navy">Production Mode</span>
              <Toggle checked={Boolean(midtrans.is_production)} onChange={(v) => setMidtrans("is_production", v)} />
            </div>
            <label className={labelClass}>Server Key</label>
            <input className={inputClass} type="password" value={midtrans.server_key || ""} onChange={(e) => setMidtrans("server_key", e.target.value)} placeholder={midtrans.server_key_masked || "Server key baru"} />
            <SecretHint configured={midtrans.server_key_configured} />
            <label className={`${labelClass} mt-3`}>Client Key</label>
            <input className={inputClass} type="password" value={midtrans.client_key || ""} onChange={(e) => setMidtrans("client_key", e.target.value)} placeholder={midtrans.client_key_masked || "Client key baru"} />
            <SecretHint configured={midtrans.client_key_configured} />
            <button type="button" onClick={() => saveSetting("midtrans", midtrans)} disabled={savingKey === "midtrans"} className="mt-3 flex h-10 items-center justify-center gap-1.5 rounded-full bg-violet px-4 text-sm font-semibold text-white disabled:opacity-60">
              <Save size={15} /> Simpan Midtrans
            </button>
          </IntegrationCard>

          <IntegrationCard icon={CreditCard} title="Transfer Manual" description="Instruksi rekening alternatif untuk pembayaran manual.">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-navy">Aktifkan Transfer Manual</span>
              <Toggle checked={Boolean(manualPayment.enabled)} onChange={(v) => setManualPayment("enabled", v)} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Bank</label>
                <input className={inputClass} value={manualPayment.bank_name || ""} onChange={(e) => setManualPayment("bank_name", e.target.value)} placeholder="BCA" />
              </div>
              <div>
                <label className={labelClass}>Nomor Rekening</label>
                <input className={inputClass} value={manualPayment.account_number || ""} onChange={(e) => setManualPayment("account_number", e.target.value)} placeholder="1234567890" />
              </div>
            </div>
            <label className={`${labelClass} mt-3`}>Nama Rekening</label>
            <input className={inputClass} value={manualPayment.account_name || ""} onChange={(e) => setManualPayment("account_name", e.target.value)} placeholder="PT / Nama Pemilik" />
            <label className={`${labelClass} mt-3`}>Instruksi</label>
            <textarea className={areaClass} value={manualPayment.instructions || ""} onChange={(e) => setManualPayment("instructions", e.target.value)} placeholder="Transfer sesuai nominal, lalu konfirmasi ke admin." />
            <button type="button" onClick={() => saveSetting("manual_payment", manualPayment)} disabled={savingKey === "manual_payment"} className="mt-3 flex h-10 items-center justify-center gap-1.5 rounded-full bg-violet px-4 text-sm font-semibold text-white disabled:opacity-60">
              <Save size={15} /> Simpan Transfer Manual
            </button>
          </IntegrationCard>

          <IntegrationCard icon={Bot} title="API AI" description="Analisa keuangan dan scan struk otomatis via SumoPod AI, dengan Anthropic sebagai alternatif.">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-navy">Aktifkan AI</span>
              <Toggle checked={Boolean(ai.enabled)} onChange={(v) => setAi("enabled", v)} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
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
            </div>
            <label className={`${labelClass} mt-3`}>SumoPod API Key</label>
            <input className={inputClass} type="password" value={ai.sumopod_api_key || ""} onChange={(e) => setAi("sumopod_api_key", e.target.value)} placeholder={ai.sumopod_api_key_masked || "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"} />
            <SecretHint configured={ai.sumopod_api_key_configured} />
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Base URL SumoPod</label>
                <input className={inputClass} value={ai.sumopod_base_url || ""} onChange={(e) => setAi("sumopod_base_url", e.target.value)} placeholder="https://ai.sumopod.com/v1" />
              </div>
              <div>
                <label className={labelClass}>Model Anthropic</label>
                <input className={inputClass} value={ai.anthropic_model || ai.model || ""} onChange={(e) => setAi("anthropic_model", e.target.value)} placeholder="claude-sonnet-4-5" />
              </div>
            </div>
            <label className={`${labelClass} mt-3`}>Anthropic API Key</label>
            <input className={inputClass} type="password" value={ai.anthropic_api_key || ""} onChange={(e) => setAi("anthropic_api_key", e.target.value)} placeholder={ai.anthropic_api_key_masked || "API key baru"} />
            <SecretHint configured={ai.anthropic_api_key_configured} />
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Limit Insight / Hari</label>
                <input className={inputClass} type="number" min="0" value={ai.insights_daily_limit || 0} onChange={(e) => setAi("insights_daily_limit", Number(e.target.value))} />
              </div>
              <div>
                <label className={labelClass}>Limit Scan Struk / Bulan</label>
                <input className={inputClass} type="number" min="0" value={ai.receipt_scan_monthly_limit || 0} onChange={(e) => setAi("receipt_scan_monthly_limit", Number(e.target.value))} />
              </div>
            </div>
            <button type="button" onClick={() => saveSetting("ai", ai)} disabled={savingKey === "ai"} className="mt-3 flex h-10 items-center justify-center gap-1.5 rounded-full bg-violet px-4 text-sm font-semibold text-white disabled:opacity-60">
              <Save size={15} /> Simpan AI
            </button>
          </IntegrationCard>

          <IntegrationCard icon={Smartphone} title="Web Push" description="Notifikasi budget mendekati atau melewati batas.">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-navy">Aktifkan Web Push</span>
              <Toggle checked={Boolean(webPush.enabled)} onChange={(v) => setWebPush("enabled", v)} />
            </div>
            <label className={labelClass}>VAPID Public Key</label>
            <input className={inputClass} value={webPush.vapid_public_key || ""} onChange={(e) => setWebPush("vapid_public_key", e.target.value)} />
            <label className={`${labelClass} mt-3`}>VAPID Private Key</label>
            <input className={inputClass} type="password" value={webPush.vapid_private_key || ""} onChange={(e) => setWebPush("vapid_private_key", e.target.value)} placeholder={webPush.vapid_private_key_masked || "Private key baru"} />
            <SecretHint configured={webPush.vapid_private_key_configured} />
            <label className={`${labelClass} mt-3`}>VAPID Subject</label>
            <input className={inputClass} value={webPush.vapid_subject || ""} onChange={(e) => setWebPush("vapid_subject", e.target.value)} placeholder="mailto:admin@finepro.my.id" />
            <button type="button" onClick={() => saveSetting("web_push", webPush)} disabled={savingKey === "web_push"} className="mt-3 flex h-10 items-center justify-center gap-1.5 rounded-full bg-violet px-4 text-sm font-semibold text-white disabled:opacity-60">
              <Save size={15} /> Simpan Web Push
            </button>
          </IntegrationCard>
        </div>
      )}

      {activeTab === "data" && (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="gloss-panel rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-navy">Users</h2>
              <form onSubmit={searchUsers} className="flex min-w-0 gap-2">
                <input className="h-9 min-w-0 rounded-full border border-neutral-border bg-white/75 px-3 text-sm outline-none" value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="Cari user" />
                <button className="flex h-9 w-9 items-center justify-center rounded-full bg-violet text-white" type="submit"><Search size={15} /></button>
              </form>
            </div>
            <div className="max-h-[520px] overflow-y-auto">
              {users.map((u) => (
                <div key={u.id} className="grid gap-2 border-b border-neutral-border/60 py-3 last:border-0 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-navy">{u.name || u.email}</div>
                    <div className="truncate text-xs text-neutral-500">{u.email}</div>
                    <div className="text-xs text-neutral-500">{u.household_name || "Belum ada household"}</div>
                  </div>
                  {canManageRoles ? (
                    <select className={inputClass} value={u.role} onChange={(e) => changeRole(u.id, e.target.value)}>
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                      <option value="super_admin">super_admin</option>
                    </select>
                  ) : (
                    <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-violet">{u.effective_role}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="gloss-panel rounded-2xl p-4">
            <h2 className="mb-3 text-base font-semibold text-navy">Households</h2>
            <div className="max-h-[520px] overflow-y-auto">
              {households.map((h) => (
                <div key={h.id} className="border-b border-neutral-border/60 py-3 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-navy">{h.name}</div>
                      <div className="truncate text-xs text-neutral-500">{h.owner_email}</div>
                    </div>
                    <span className="rounded-full bg-violet-light px-3 py-1 text-xs font-medium text-violet">{h.subscription_status || "unknown"}</span>
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">{h.household_type} · {h.member_count} anggota · {h.plan || "trial"}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="gloss-panel rounded-2xl p-4 xl:col-span-2">
            <h2 className="mb-3 text-base font-semibold text-navy">Payments</h2>
            <div className="grid gap-2 md:grid-cols-2">
              {payments.map((p) => (
                <div key={p.order_id} className="rounded-2xl bg-white/65 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-semibold text-navy">{p.household_name}</div>
                    <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-violet">{p.status}</span>
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">{p.owner_email}</div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="font-medium text-neutral-500">{p.plan}</span>
                    <span className="font-semibold text-navy">{fmtRp(p.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "audit" && (
        <div className="gloss-panel rounded-2xl p-4">
          <h2 className="mb-3 text-base font-semibold text-navy">Audit Log</h2>
          {logs.map((log) => (
            <div key={log.id} className="border-b border-neutral-border/60 py-3 last:border-0">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-navy">{log.action}</div>
                <div className="text-xs text-neutral-500">{new Date(log.created_at).toLocaleString("id-ID")}</div>
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                {log.admin_email} · {log.target_type || "-"} {log.target_id || ""}
              </div>
              {log.metadata && (
                <pre className="mt-2 overflow-x-auto rounded-xl bg-white/70 p-2 text-[11px] text-neutral-700">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              )}
            </div>
          ))}
          {logs.length === 0 && <div className="py-6 text-center text-sm text-neutral-500">Belum ada audit log.</div>}
        </div>
      )}
    </div>
  );
}
