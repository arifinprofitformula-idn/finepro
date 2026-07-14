import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Archive,
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
  LogOut,
  Mail,
  MessageCircle,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Settings,
  UserCog,
  UserPlus,
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
import { mediaUrl } from "../utils/media.js";

const tabs = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "integrations", label: "Integrasi", icon: Database },
  { id: "data", label: "Data", icon: Users },
  { id: "audit", label: "Audit", icon: History }
];

const toneMap = {
  violet: {
    icon: "bg-[#e2dfff] text-[#3525cd]",
    badge: "bg-[#e2dfff] text-[#3525cd]",
    line: "bg-[#3525cd]"
  },
  mint: {
    icon: "bg-[#6cf8bb] text-[#006c49]",
    badge: "bg-[#6cf8bb]/40 text-[#006c49]",
    line: "bg-[#006c49]"
  },
  gold: {
    icon: "bg-[#ffdadc] text-[#8b1b34]",
    badge: "bg-[#ffdadc] text-[#8b1b34]",
    line: "bg-[#8b1b34]"
  },
  navy: {
    icon: "bg-[#213145] text-[#eaf1ff]",
    badge: "bg-[#213145] text-[#eaf1ff]",
    line: "bg-[#213145]"
  },
  coral: {
    icon: "bg-[#ffdad6] text-[#ba1a1a]",
    badge: "bg-[#ffdad6] text-[#93000a]",
    line: "bg-[#ba1a1a]"
  }
};

const inputClass =
  "h-11 w-full rounded-lg border border-white/30 bg-white/35 px-3 text-sm font-semibold text-[#0b1c30] shadow-[inset_1px_1px_0_rgba(255,255,255,0.55),inset_-1px_-1px_0_rgba(53,37,205,0.06)] outline-none backdrop-blur-xl transition placeholder:text-[#464555]/70 focus:border-white/60 focus:bg-white/55 focus:shadow-[0_0_0_4px_rgba(53,37,205,0.12),inset_1px_1px_0_rgba(255,255,255,0.72)]";
const areaClass =
  "min-h-24 w-full rounded-lg border border-white/30 bg-white/35 px-3 py-2 text-sm font-semibold text-[#0b1c30] shadow-[inset_1px_1px_0_rgba(255,255,255,0.55),inset_-1px_-1px_0_rgba(53,37,205,0.06)] outline-none backdrop-blur-xl transition placeholder:text-[#464555]/70 focus:border-white/60 focus:bg-white/55 focus:shadow-[0_0_0_4px_rgba(53,37,205,0.12),inset_1px_1px_0_rgba(255,255,255,0.72)]";
const labelClass = "mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#464555]";
const glassPanel =
  "relative overflow-hidden rounded-xl border border-white/30 bg-white/20 shadow-[0_24px_70px_rgba(27,36,84,0.18),inset_1px_1px_0_rgba(255,255,255,0.72),inset_-1px_-1px_0_rgba(53,37,205,0.08)] backdrop-blur-2xl";
const glassCard =
  "relative overflow-hidden rounded-xl border border-white/25 bg-white/18 shadow-[0_18px_55px_rgba(27,36,84,0.14),inset_1px_1px_0_rgba(255,255,255,0.62),inset_-1px_-1px_0_rgba(53,37,205,0.08)] backdrop-blur-xl";
const glassSoft =
  "rounded-lg border border-white/25 bg-white/28 shadow-[inset_1px_1px_0_rgba(255,255,255,0.58),0_10px_28px_rgba(27,36,84,0.08)] backdrop-blur-xl";
const glassButton =
  "border border-white/35 bg-white/30 shadow-[0_14px_32px_rgba(27,36,84,0.12),inset_1px_1px_0_rgba(255,255,255,0.68)] backdrop-blur-xl";

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`group relative flex h-9 w-[74px] flex-shrink-0 items-center rounded-full border px-1 outline-none transition-all duration-300 ease-out focus:shadow-[0_0_0_4px_rgba(111,85,242,0.14)] active:scale-[0.98] ${
        checked
          ? "border-white/45 bg-[#006c49]/80 shadow-[0_14px_28px_rgba(0,108,73,0.24),inset_1px_1px_0_rgba(255,255,255,0.38)] backdrop-blur-xl"
          : "border-white/35 bg-white/32 shadow-[inset_1px_1px_0_rgba(255,255,255,0.65),inset_-1px_-1px_0_rgba(27,36,84,0.08)] backdrop-blur-xl hover:border-white/55"
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
        className={`absolute top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-[0_8px_18px_rgba(27,36,84,0.20),inset_1px_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl transition-all duration-300 ease-out ${
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
    <span className={`inline-flex items-center rounded-full border border-white/25 px-2.5 py-1 text-[11px] font-bold shadow-[inset_1px_1px_0_rgba(255,255,255,0.55)] backdrop-blur-xl ${toneMap[tone].badge}`}>
      {children}
    </span>
  );
}

function SectionTitle({ icon: Icon, title, subtitle, tone = "violet", action }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${toneMap[tone].icon}`}>
          <Icon size={17} />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold text-[#0b1c30]">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs font-medium leading-relaxed text-[#464555]">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone = "violet" }) {
  return (
    <div className={`group min-h-[150px] p-5 transition hover:-translate-y-1 hover:border-white/55 hover:bg-white/28 hover:shadow-[0_28px_80px_rgba(27,36,84,0.22),inset_1px_1px_0_rgba(255,255,255,0.78)] ${glassCard}`}>
      <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-white/80" />
      <div className={`absolute left-0 top-0 h-full w-1 ${toneMap[tone].line}`} />
      <div className="relative z-10 flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${toneMap[tone].icon}`}>
            <Icon size={20} />
          </div>
          <div className={`rounded-full px-2 py-1 text-[11px] font-bold ${toneMap[tone].badge}`}>
            Live
          </div>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#464555]">{label}</div>
          <div className="mt-2 truncate text-2xl font-extrabold tracking-tight text-[#0b1c30]">{value}</div>
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
    <section className={`p-5 ${glassCard}`}>
      <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-white/80" />
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

function IntegrationTile({
  icon: Icon,
  title,
  description,
  tone = "violet",
  enabled,
  onToggle,
  detailLabel,
  detailValue,
  progress = 70,
  onConfigure
}) {
  return (
    <article className={`group flex min-h-[286px] flex-col p-5 transition hover:-translate-y-1 hover:border-white/55 hover:bg-white/28 ${glassCard}`}>
      <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-white/80" />
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${toneMap[tone].icon}`}>
          <Icon size={24} />
        </div>
        <div className="flex flex-col items-end gap-2">
          <Toggle checked={Boolean(enabled)} onChange={onToggle} />
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide shadow-[inset_1px_1px_0_rgba(255,255,255,0.55)] ${enabled ? toneMap.mint.badge : "bg-white/35 text-[#464555]"}`}>
            {enabled ? "Connected" : "Inactive"}
          </span>
        </div>
      </div>

      <div className="flex-1">
        <h3 className="text-xl font-extrabold tracking-tight text-[#0b1c30]">{title}</h3>
        <p className="mt-2 h-12 overflow-hidden text-sm font-medium leading-6 text-[#464555]">{description}</p>
      </div>

      <div className="mt-5 border-t border-white/25 pt-4">
        <div className="mb-2 flex items-center justify-between text-xs font-bold">
          <span className="text-[#777587]">{detailLabel}</span>
          <span className="text-[#0b1c30]">{detailValue}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/35 shadow-[inset_0_1px_2px_rgba(27,36,84,0.12)]">
          <div className={`h-full rounded-full ${toneMap[tone].line}`} style={{ width: `${Math.min(Math.max(progress, 8), 100)}%` }} />
        </div>
      </div>

      <button
        type="button"
        onClick={onConfigure}
        className={`mt-5 flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold text-[#3525cd] transition hover:bg-white/45 ${glassButton}`}
      >
        Configure
        <ChevronRight size={16} />
      </button>
    </article>
  );
}

function TechnicalPanel({ midtrans, telegram, apeEpi }) {
  const deliveries = [
    {
      event: "payment.notification",
      service: "Midtrans",
      status: midtrans.enabled ? "Delivered" : "Paused",
      tone: midtrans.enabled ? "mint" : "gold"
    },
    {
      event: "telegram.chat.ai",
      service: "Telegram Bot",
      status: telegram.enabled ? "Ready" : "Inactive",
      tone: telegram.enabled ? "violet" : "gold"
    },
    {
      event: "price.refresh",
      service: "APE-EPI",
      status: apeEpi.enabled ? "Cached" : "Paused",
      tone: apeEpi.enabled ? "mint" : "gold"
    }
  ];

  return (
    <section className={`p-5 ${glassPanel}`}>
      <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-white/80" />
      <SectionTitle
        icon={History}
        title="Recent Webhook Deliveries"
        subtitle="Ringkasan event teknis dari integrasi utama."
        tone="violet"
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left">
          <thead>
            <tr className="border-b border-white/25 text-[11px] font-extrabold uppercase tracking-wide text-[#464555]">
              <th className="pb-3">Event</th>
              <th className="pb-3">Service</th>
              <th className="pb-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((item) => (
              <tr key={item.event} className="border-b border-white/15 text-sm font-bold last:border-0">
                <td className="py-3 text-[#0b1c30]">{item.event}</td>
                <td className="py-3 text-[#464555]">{item.service}</td>
                <td className="py-3 text-right">
                  <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function getInitials(nameOrEmail = "") {
  const cleaned = String(nameOrEmail).trim();
  if (!cleaned) return "FP";
  const name = cleaned.includes("@") ? cleaned.split("@")[0] : cleaned;
  const parts = name
    .replace(/[^a-zA-Z0-9\s._-]/g, " ")
    .split(/[\s._-]+/)
    .filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)).toUpperCase();
}

function AdminAvatar({ user }) {
  const label = user?.name || user?.email || "Admin";
  return (
    <div
      className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/40 bg-white/35 text-sm font-extrabold text-[#3525cd] shadow-[0_14px_30px_rgba(27,36,84,0.16),inset_1px_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl"
      title={label}
      aria-label={label}
    >
      {user?.avatar_url ? (
        <img src={mediaUrl(user.avatar_url)} alt="" className="h-full w-full object-cover" />
      ) : (
        getInitials(label)
      )}
    </div>
  );
}

function auditTone(log) {
  const text = `${log.action || ""} ${log.target_type || ""}`.toLowerCase();
  if (text.includes("fail") || text.includes("error") || text.includes("delete")) return "coral";
  if (text.includes("user") || text.includes("role")) return "mint";
  if (text.includes("setting") || text.includes("config")) return "violet";
  return "navy";
}

function auditIcon(log) {
  const text = `${log.action || ""} ${log.target_type || ""}`.toLowerCase();
  if (text.includes("fail") || text.includes("error") || text.includes("delete")) return AlertTriangle;
  if (text.includes("user") || text.includes("role")) return UserPlus;
  if (text.includes("backup") || text.includes("storage")) return Archive;
  if (text.includes("setting") || text.includes("config")) return Settings;
  return ShieldCheck;
}

function AuditDashboard({ logs }) {
  const configCount = logs.filter((log) => auditTone(log) === "violet").length;
  const actorCount = new Set(logs.map((log) => log.admin_email).filter(Boolean)).size;

  const metrics = [
    {
      label: "Active Sessions",
      value: actorCount || 1,
      icon: Users,
      tone: "violet",
      progress: Math.min(92, 44 + actorCount * 12)
    },
    {
      label: "Config Events",
      value: configCount,
      icon: Settings,
      tone: "mint",
      progress: Math.min(95, 30 + configCount * 14)
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-12">
        <section className="grid gap-6 sm:grid-cols-2 xl:col-span-12">
          {metrics.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className={`p-6 ${glassCard}`}>
                <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-white/80" />
                <div className="mb-5 flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${toneMap[item.tone].icon}`}>
                    <Icon size={26} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#464555]">{item.label}</p>
                    <p className="mt-1 text-3xl font-extrabold text-[#0b1c30]">{item.value}</p>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/35 shadow-[inset_0_1px_2px_rgba(27,36,84,0.12)]">
                  <div className={`h-full rounded-full ${toneMap[item.tone].line}`} style={{ width: `${item.progress}%` }} />
                </div>
              </div>
            );
          })}

          <div className="relative overflow-hidden rounded-xl border border-white/25 bg-[#4f46e5]/75 p-6 text-[#dad7ff] shadow-[0_26px_70px_rgba(53,37,205,0.28),inset_1px_1px_0_rgba(255,255,255,0.32)] backdrop-blur-2xl sm:col-span-2">
            <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-white/60" />
            <div className="relative z-10">
              <h3 className="text-xl font-bold text-white">Data Residency Compliant</h3>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#dad7ff]/85">
                Audit log tersimpan dengan kontrol akses admin dan riwayat aktivitas bisa ditelusuri dari feed ini.
              </p>
            </div>
            <ShieldCheck className="absolute -right-8 top-1/2 -translate-y-1/2 text-white/10" size={150} />
          </div>
        </section>
      </div>

      <section className={glassPanel}>
        <div className="flex flex-col gap-3 border-b border-white/25 bg-white/18 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#0b1c30]">Recent Activity Items</h2>
            <p className="mt-1 text-xs font-semibold text-[#777587]">Showing last {Math.min(logs.length, 100)} events</p>
          </div>
        </div>

        <div>
          {logs.map((log) => {
            const Icon = auditIcon(log);
            const tone = auditTone(log);
            return (
              <div key={log.id} className="flex flex-col gap-4 border-b border-white/20 p-5 transition last:border-b-0 hover:bg-white/18 lg:flex-row lg:items-start">
                <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full ${toneMap[tone].icon}`}>
                  <Icon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <h3 className={`text-sm font-extrabold ${tone === "coral" ? "text-[#ba1a1a]" : "text-[#0b1c30]"}`}>{log.action}</h3>
                    <span className="text-xs font-semibold text-[#777587]">{new Date(log.created_at).toLocaleString("id-ID")}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium leading-6 text-[#464555]">
                    Admin <span className="font-bold text-[#3525cd]">{log.admin_email || "system"}</span>
                    {log.target_type ? ` melakukan perubahan pada ${log.target_type}.` : " menjalankan aktivitas sistem."}
                  </p>
                  {log.metadata && (
                    <pre className="mt-3 max-h-36 overflow-auto rounded-lg border border-white/30 bg-white/38 p-3 text-[11px] font-semibold leading-relaxed text-[#26344a] shadow-[inset_1px_1px_0_rgba(255,255,255,0.55)] backdrop-blur-xl">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <StatusBadge tone={tone}>{log.target_type || "System"}</StatusBadge>
                  <StatusBadge tone={tone === "coral" ? "coral" : "mint"}>{tone === "coral" ? "Review" : "Success"}</StatusBadge>
                </div>
              </div>
            );
          })}
          {logs.length === 0 && <div className="py-10 text-center text-sm font-semibold text-[#777587]">Belum ada audit log.</div>}
        </div>
      </section>
    </div>
  );
}

function SaveButton({ label, saving, onClick, tone = "violet" }) {
  const bg = tone === "mint" ? "from-[#006c49] to-[#4edea3]" : tone === "gold" ? "from-[#8b1b34] to-[#ffb2b9]" : tone === "navy" ? "from-[#213145] to-[#4f6685]" : "from-[#3525cd] to-[#6f66ff]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      className={`flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-lg border border-white/25 bg-gradient-to-br px-4 text-sm font-bold text-white shadow-[0_18px_42px_rgba(27,36,84,0.18),inset_1px_1px_0_rgba(255,255,255,0.34)] transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60 sm:w-auto ${bg}`}
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

export default function AdminPage({ user, onLogout }) {
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
      const prices = await testApeEpiConnection(apeEpi);
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
  const pageTitle = activeTab === "overview" ? "Overview Dashboard" : activeTab === "integrations" ? "Integrations" : activeTab === "data" ? "Data Management" : activeTab === "audit" ? "System Activity Feed" : activeTabLabel;
  const pageSubtitle = activeTab === "overview"
    ? "Real-time performance metrics dan ringkasan operasional FinePro."
    : activeTab === "integrations"
    ? "Connect and manage your third-party tools and internal automation engines."
    : activeTab === "data"
    ? "Configure user profiles, household asset structures, and monitor system integrity."
    : activeTab === "audit"
    ? "Real-time audit records and security event monitoring."
    : "Kelola integrasi, pengguna, pembayaran, dan jejak aktivitas sistem.";
  const scrollToIntegrationSettings = () => {
    document.getElementById("integration-settings")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const integrationTiles = [
    {
      icon: BrainCircuit,
      title: "AI Limit Controller",
      description: "Batas harian AI, scan receipt, insight keuangan, dan chat Telegram per pengguna.",
      tone: "mint",
      enabled: ai.enabled,
      onToggle: (v) => setAi("enabled", v),
      detailLabel: "Telegram chat/user",
      detailValue: `${aiQuota.telegram_chat_daily ?? 100}/hari`,
      progress: 78
    },
    {
      icon: Gem,
      title: "Auto Price Engine",
      description: "Sinkronisasi harga GOLDGRAM dan SILVERGRAM melalui APE-EPI untuk target aset.",
      tone: "gold",
      enabled: apeEpi.enabled,
      onToggle: (v) => setApeEpi("enabled", v),
      detailLabel: "Cache refresh",
      detailValue: `${apeEpi.cache_ttl_minutes ?? 30} menit`,
      progress: 64
    },
    {
      icon: Landmark,
      title: "Manual Transfer",
      description: "Jalur pembayaran bank alternatif untuk pengguna yang belum memakai payment gateway.",
      tone: "navy",
      enabled: manualPayment.enabled,
      onToggle: (v) => setManualPayment("enabled", v),
      detailLabel: "Account",
      detailValue: manualPayment.bank_name || "Belum diatur",
      progress: manualPayment.account_number ? 82 : 28
    },
    {
      icon: CreditCard,
      title: "Midtrans",
      description: "Payment gateway untuk subscription, notifikasi transaksi, dan mode produksi.",
      tone: "violet",
      enabled: midtrans.enabled,
      onToggle: (v) => setMidtrans("enabled", v),
      detailLabel: "Mode",
      detailValue: midtrans.is_production ? "Production" : "Sandbox",
      progress: midtrans.server_key_configured ? 86 : 38
    },
    {
      icon: Mail,
      title: "Mailketing",
      description: "Email transactional untuk reset password, laporan, dan komunikasi otomatis.",
      tone: "coral",
      enabled: mailketing.enabled,
      onToggle: (v) => setMailketing("enabled", v),
      detailLabel: "Sender",
      detailValue: mailketing.from_email || "Belum diatur",
      progress: mailketing.api_token_configured ? 74 : 35
    },
    {
      icon: MessageCircle,
      title: "Telegram Bot",
      description: "Bot chat, upload struk, workflow n8n, dan automation entry point dari Telegram.",
      tone: "violet",
      enabled: telegram.enabled,
      onToggle: (v) => setTelegram("enabled", v),
      detailLabel: "Bot",
      detailValue: telegram.bot_username || "Belum diatur",
      progress: telegram.bot_token_configured ? 80 : 30
    },
    {
      icon: BellRing,
      title: "Web Push",
      description: "Notifikasi budget dan reminder langsung ke browser pengguna.",
      tone: "gold",
      enabled: webPush.enabled,
      onToggle: (v) => setWebPush("enabled", v),
      detailLabel: "Subject",
      detailValue: webPush.vapid_subject || "Belum diatur",
      progress: webPush.vapid_private_key_configured ? 70 : 24
    }
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_8%_5%,rgba(108,248,187,0.42),transparent_28%),radial-gradient(circle_at_90%_10%,rgba(226,223,255,0.78),transparent_30%),radial-gradient(circle_at_78%_82%,rgba(255,218,220,0.62),transparent_32%),linear-gradient(135deg,#f8f9ff_0%,#dce9ff_48%,#f8f9ff_100%)] font-['Plus_Jakarta_Sans',system-ui,sans-serif] text-[#0b1c30]">
      <div className="pointer-events-none fixed -left-24 top-24 h-72 w-72 rounded-full bg-[#6cf8bb]/30 blur-3xl" />
      <div className="pointer-events-none fixed right-0 top-20 h-96 w-96 rounded-full bg-[#3525cd]/18 blur-3xl" />
      <div className="pointer-events-none fixed bottom-0 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[#ffb2b9]/30 blur-3xl" />
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-64 flex-col border-r border-white/25 bg-white/18 px-3 py-6 shadow-[18px_0_60px_rgba(27,36,84,0.12),inset_-1px_0_0_rgba(255,255,255,0.35)] backdrop-blur-2xl lg:flex">
        <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-white/75" />
        <button type="button" onClick={() => { window.location.href = "/"; }} className="mb-10 px-4 text-left">
          <div className="inline-flex rounded-xl border border-white/30 bg-white/28 px-3 py-2 shadow-[inset_1px_1px_0_rgba(255,255,255,0.66),0_14px_32px_rgba(27,36,84,0.10)] backdrop-blur-xl">
            <img src="/images/fine-pro-header.png" alt="FinePro" className="h-8 w-auto object-contain" />
          </div>
          <div className="mt-2 px-1 text-xs font-semibold text-[#464555]">Admin Dashboard</div>
        </button>
        <nav className="flex-1 space-y-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-h-[46px] w-full items-center gap-3 rounded-lg border-l-4 px-4 text-sm font-bold transition active:scale-[0.98] ${
                  active
                    ? "border-white/70 bg-white/35 text-[#3525cd] shadow-[0_14px_34px_rgba(53,37,205,0.16),inset_1px_1px_0_rgba(255,255,255,0.68)]"
                    : "border-transparent text-[#26344a] hover:bg-white/24 hover:text-[#3525cd]"
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-white/25 pt-4">
          <button
            type="button"
            onClick={onLogout}
            className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-4 text-sm font-bold text-[#ba1a1a] transition hover:bg-white/28"
          >
            <LogOut size={18} />
            Keluar
          </button>
        </div>
      </aside>

      <header className="fixed left-0 right-0 top-0 z-20 flex h-16 items-center justify-between border-b border-white/25 bg-white/20 px-4 shadow-[0_18px_50px_rgba(27,36,84,0.10),inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-2xl lg:left-64 lg:px-10">
        <button
          type="button"
          onClick={() => { window.location.href = "/"; }}
          className="inline-flex items-center rounded-xl border border-white/30 bg-white/28 px-3 py-1.5 shadow-[inset_1px_1px_0_rgba(255,255,255,0.66)] backdrop-blur-xl lg:hidden"
          aria-label="FinePro"
        >
          <img src="/images/fine-pro-header.png" alt="FinePro" className="h-7 w-auto object-contain" />
        </button>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={loadAll}
            className={`flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold text-[#3525cd] transition hover:bg-white/45 ${glassButton}`}
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <AdminAvatar user={user} />
        </div>
      </header>

      <section className="relative z-10 min-h-screen px-4 pb-20 pt-20 sm:px-6 lg:ml-64 lg:px-10">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="flex flex-col gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-white/30 px-3 py-1 text-[11px] font-bold text-[#3525cd] shadow-[inset_1px_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl">
                <ShieldCheck size={13} />
                Admin Console
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-[#0b1c30] sm:text-3xl">
                {pageTitle}
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-[#464555]">
                {pageSubtitle}
              </p>
            </div>
          </section>

      {message && (
        <div className={`p-3 text-sm font-bold text-[#0b1c30] ${glassPanel}`}>
          {message}
        </div>
      )}

      <div className="sticky top-16 z-10 -mx-4 border-y border-white/25 bg-white/20 px-4 py-2 shadow-[0_14px_38px_rgba(27,36,84,0.10)] backdrop-blur-2xl sm:mx-0 sm:rounded-xl sm:border lg:hidden">
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
                  active ? "bg-[#3525cd]/90 text-white shadow-[0_12px_24px_rgba(53,37,205,0.20)]" : "text-[#26344a] hover:bg-white/28 hover:text-[#3525cd]"
                }`}
              >
                <Icon size={16} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#464555]">
        <span>{activeTabLabel}</span>
        <ChevronRight size={13} />
        <span className="text-[#3525cd]">{loading ? "Memuat" : "Siap"}</span>
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
        <div className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {integrationTiles.map((item) => (
              <IntegrationTile
                key={item.title}
                {...item}
                onConfigure={scrollToIntegrationSettings}
              />
            ))}
          </div>

          <TechnicalPanel apeEpi={apeEpi} midtrans={midtrans} telegram={telegram} />

          <section id="integration-settings" className={`scroll-mt-28 p-4 ${glassPanel}`}>
            <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-white/80" />
            <SectionTitle
              icon={Database}
              title="Configuration Workspace"
              subtitle="Atur kredensial, mode produksi, limit AI, dan automation detail untuk setiap integrasi."
              tone="violet"
            />
            <div className="grid gap-4 xl:grid-cols-2">
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
            <div className={`flex items-center justify-between px-3 py-2 ${glassSoft}`}>
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

          <section className={`p-4 ${glassCard}`}>
            <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-white/80" />
            <SectionTitle
              icon={BrainCircuit}
              title="Limit Penggunaan AI"
              subtitle="Mengatur kuota AI web, scan, dan chat Telegram."
              tone="mint"
            />
            <div className="relative z-10 space-y-4">
              <div className="rounded-xl border border-white/25 bg-[#6cf8bb]/18 p-3 shadow-[inset_1px_1px_0_rgba(255,255,255,0.55)] backdrop-blur-xl">
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

              <div className={`${glassSoft} p-3`}>
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

              <div className="rounded-xl border border-white/25 bg-[#e2dfff]/35 p-3 shadow-[inset_1px_1px_0_rgba(255,255,255,0.55)] backdrop-blur-xl">
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

              <div className="rounded-xl border border-white/25 bg-[#ffdadc]/35 p-3 shadow-[inset_1px_1px_0_rgba(255,255,255,0.55)] backdrop-blur-xl">
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gold">Telegram AI</div>
                <div>
                  <label className={labelClass}>Chat AI / User / Hari</label>
                  <input className={inputClass} type="number" min="0" value={aiQuota.telegram_chat_daily ?? 100} onChange={(e) => setAiQuota("telegram_chat_daily", Number(e.target.value))} />
                </div>
              </div>

              <div className={`${glassSoft} px-3 py-2 text-xs font-semibold leading-relaxed text-[#464555]`}>
                Scan otomatis dihitung gabungan dari web, upload file, kamera, dan Telegram. Insight dihitung dari tombol Analisa Keuangan. Chat AI Telegram dihitung per pengguna setiap hari saat pesan teks memicu AI.
              </div>

              <SaveButton label="Simpan Limit AI" saving={savingKey === "ai_quota"} onClick={() => saveSetting("ai_quota", aiQuota)} tone="mint" />
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
                  className={`flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-bold text-[#3525cd] transition active:scale-[0.98] disabled:opacity-60 sm:w-auto ${glassButton}`}
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
                  {apePreview.gold?.query_variant && <div className="text-[10px] font-semibold text-neutral-400">Query {apePreview.gold.query_variant}</div>}
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-violet">SILVERGRAM</div>
                  <div className="mt-1 text-sm font-bold text-navy">{fmtRp(Number(apePreview.silver?.price_per_gram || 0))} / gram</div>
                  <div className="text-[11px] font-semibold text-neutral-500">Diambil {formatFetchedAt(apePreview.silver?.fetched_at)}</div>
                  {apePreview.silver?.date && <div className="text-[10px] font-semibold text-neutral-400">Tanggal harga {apePreview.silver.date}</div>}
                  {apePreview.silver?.query_variant && <div className="text-[10px] font-semibold text-neutral-400">Query {apePreview.silver.query_variant}</div>}
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
          </section>
        </div>
      )}

      {activeTab === "data" && (
        <div className="space-y-6">
          <div className="grid gap-5 lg:grid-cols-2">
            <section className={`p-6 ${glassPanel}`}>
              <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-white/80" />
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e2dfff] text-[#3525cd]">
                    <UserCog size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#0b1c30]">System Users</h2>
                    <p className="mt-1 text-xs font-semibold text-[#464555]">{users.length} akun ditampilkan</p>
                  </div>
                </div>
                <form onSubmit={searchUsers} className="flex min-w-0 gap-2">
                  <input
                    className="h-10 min-w-0 rounded-full border border-white/30 bg-white/35 px-4 text-sm font-semibold text-[#0b1c30] shadow-[inset_1px_1px_0_rgba(255,255,255,0.55)] outline-none backdrop-blur-xl transition placeholder:text-[#464555]/70 focus:bg-white/55 focus:shadow-[0_0_0_3px_rgba(53,37,205,0.12)]"
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    placeholder="Cari user"
                  />
                  <button className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#3525cd] text-white transition hover:brightness-110" type="submit" title="Cari">
                    <Search size={15} />
                  </button>
                </form>
              </div>

              <div className="max-h-[500px] space-y-3 overflow-y-auto pr-1">
                {users.map((u, index) => (
                  <div key={u.id} className="group flex flex-col gap-3 rounded-lg border border-transparent p-3 transition hover:border-white/25 hover:bg-white/20 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${index % 3 === 0 ? "bg-[#e2dfff] text-[#3525cd]" : index % 3 === 1 ? "bg-[#ffdadc] text-[#8b1b34]" : "bg-[#d3e4fe] text-[#464555]"}`}>
                        {getInitials(u.name || u.email)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-[#0b1c30]">{u.name || u.email}</div>
                        <div className="truncate text-xs font-semibold text-[#777587]">{u.email}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <StatusBadge tone={u.effective_role === "super_admin" ? "navy" : u.effective_role === "admin" ? "violet" : "mint"}>
                        {u.effective_role || u.role}
                      </StatusBadge>
                      <StatusBadge tone="gold">{u.household_name || "Tanpa household"}</StatusBadge>
                      {canManageRoles && (
                        <select className={`${inputClass} h-9 sm:w-40`} value={u.role} onChange={(e) => changeRole(u.id, e.target.value)}>
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                          <option value="super_admin">super_admin</option>
                        </select>
                      )}
                    </div>
                  </div>
                ))}
                {users.length === 0 && <div className="py-8 text-center text-sm font-semibold text-[#777587]">Tidak ada user.</div>}
              </div>
            </section>

            <section className={`p-6 ${glassPanel}`}>
              <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-white/80" />
              <div className="mb-6 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e2dfff] text-[#3525cd]">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#0b1c30]">Household Portfolios</h2>
                    <p className="mt-1 text-xs font-semibold text-[#464555]">{households.length} workspace aktif/tercatat</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {households.map((h) => {
                  const memberCount = Number(h.member_count || 0);
                  const paymentTotal = payments
                    .filter((p) => p.household_name === h.name)
                    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
                  return (
                    <div key={h.id} className={`flex items-center justify-between gap-4 p-5 ${glassSoft}`}>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-[#0b1c30]">{h.name}</h3>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="text-xl font-extrabold text-[#3525cd]">{paymentTotal > 0 ? fmtRp(paymentTotal) : `${memberCount} anggota`}</span>
                          <StatusBadge tone={h.subscription_status === "active" ? "mint" : "gold"}>
                            {h.subscription_status || "unknown"}
                          </StatusBadge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <StatusBadge tone="violet">{h.household_type || "household"}</StatusBadge>
                          <StatusBadge tone="navy">{h.plan || "trial"}</StatusBadge>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {households.length === 0 && <div className="py-8 text-center text-sm font-semibold text-[#777587]">Tidak ada household.</div>}
              </div>
            </section>
          </div>

          <section className={`p-6 ${glassPanel}`}>
            <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-white/80" />
            <SectionTitle icon={WalletCards} title="Payment Activity" subtitle={`${payments.length} transaksi pembayaran terakhir`} tone="gold" />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {payments.map((p) => (
                <div key={p.order_id} className={`${glassSoft} p-4`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-[#0b1c30]">{p.household_name}</div>
                      <div className="truncate text-xs font-semibold text-[#777587]">{p.owner_email}</div>
                    </div>
                    <StatusBadge tone={paymentTone(p.status)}>{p.status}</StatusBadge>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div className="text-xs font-extrabold uppercase tracking-wide text-[#464555]">{p.plan}</div>
                    <div className="text-base font-extrabold text-[#3525cd]">{fmtRp(p.amount)}</div>
                  </div>
                </div>
              ))}
              {payments.length === 0 && <div className="py-8 text-center text-sm font-semibold text-[#777587] md:col-span-2 xl:col-span-3">Belum ada payment.</div>}
            </div>
          </section>
        </div>
      )}

      {activeTab === "audit" && (
        <AuditDashboard logs={logs} />
      )}
        </div>
      </section>
    </main>
  );
}
