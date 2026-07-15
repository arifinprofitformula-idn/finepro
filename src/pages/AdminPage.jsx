import { useEffect, useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
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
  Phone,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Settings,
  UserCog,
  UserPlus,
  Users,
  WalletCards,
  X
} from "lucide-react";
import {
  getAdminAuditLogs,
  getApeEpiStatus,
  getAdminHouseholdDetail,
  getAdminHouseholds,
  getAdminOverview,
  getAdminPayments,
  getAdminSettings,
  getAdminUsers,
  getMailketingLists,
  recordManualPayment,
  reviewManualPayment,
  testMailketingEmail,
  updateAdminSetting,
  updateAdminUserRole,
  testApeEpiConnection
} from "../api/admin.js";
import { fmtRp } from "../utils/format.js";
import { mediaUrl } from "../utils/media.js";

const PAGE_SIZE = 10;

const MANUAL_PAYMENT_PLANS = [
  { value: "monthly", label: "Bulanan", amount: 29000 },
  { value: "semiannual", label: "6 Bulan", amount: 149000 },
  { value: "annual", label: "Tahunan", amount: 249000 }
];

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
const labelClass = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#464555]";
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
        className={`absolute text-[9px] font-semibold-TMP uppercase tracking-wide transition-all duration-300 ${
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
    <span className={`inline-flex items-center rounded-full border border-white/25 px-2.5 py-1 text-[11px] font-semibold shadow-[inset_1px_1px_0_rgba(255,255,255,0.55)] backdrop-blur-xl ${toneMap[tone].badge}`}>
      {children}
    </span>
  );
}

function PaginationControls({ page, pageSize, total, onPageChange }) {
  const start = total === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(total, (page + 1) * pageSize);
  const hasPrev = page > 0;
  const hasNext = end < total;

  return (
    <div className="flex flex-col gap-2 pt-3 text-xs font-semibold text-[#464555] sm:flex-row sm:items-center sm:justify-between">
      <span>{total === 0 ? "Tidak ada data" : `Menampilkan ${start}–${end} dari ${total}`}</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev}
          className="flex h-8 items-center justify-center rounded-lg border border-[#c7c4d8] bg-white px-3 text-xs font-semibold text-[#464555] transition hover:bg-[#eff4ff] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Sebelumnya
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
          className="flex h-8 items-center justify-center rounded-lg border border-[#c7c4d8] bg-white px-3 text-xs font-semibold text-[#464555] transition hover:bg-[#eff4ff] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Berikutnya
        </button>
      </div>
    </div>
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
          <h2 className="truncate text-base font-semibold text-[#0b1c30]">{title}</h2>
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
          <div className={`rounded-full px-2 py-1 text-[11px] font-semibold ${toneMap[tone].badge}`}>
            Live
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#464555]">{label}</div>
          <div className="mt-2 truncate text-2xl font-bold tracking-tight text-[#0b1c30]">{value}</div>
        </div>
      </div>
    </div>
  );
}

function SecretHint({ configured }) {
  return (
    <div className={`mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold ${configured ? "text-mint" : "text-neutral-500"}`}>
      {configured ? <CheckCircle2 size={12} /> : <KeyRound size={12} />}
      {configured ? "Secret tersimpan. Biarkan kosong jika tidak diganti." : "Secret belum tersimpan."}
    </div>
  );
}

function IntegrationCard({ id, icon: Icon, title, description, tone = "violet", enabled, onToggle, children, footer }) {
  return (
    <section id={id} className={`scroll-mt-28 p-5 ${glassCard}`}>
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
  progressLabel,
  onConfigure
}) {
  const normalizedProgress = Math.min(Math.max(Number(progress) || 0, 0), 100);
  const complete = normalizedProgress === 100;
  const progressLineClass = complete ? toneMap.mint.line : toneMap[tone].line;

  return (
    <article className={`group flex min-h-[286px] flex-col p-5 transition hover:-translate-y-1 hover:border-white/55 hover:bg-white/28 ${glassCard}`}>
      <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-white/80" />
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${toneMap[tone].icon}`}>
          <Icon size={24} />
        </div>
        <div className="flex flex-col items-end gap-2">
          <Toggle checked={Boolean(enabled)} onChange={onToggle} />
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide shadow-[inset_1px_1px_0_rgba(255,255,255,0.55)] ${enabled ? toneMap.mint.badge : "bg-white/35 text-[#464555]"}`}>
            {enabled ? "Connected" : "Inactive"}
          </span>
        </div>
      </div>

      <div className="flex-1">
        <h3 className="text-xl font-semibold tracking-tight text-[#0b1c30]">{title}</h3>
        <p className="mt-2 h-12 overflow-hidden text-sm font-medium leading-6 text-[#464555]">{description}</p>
      </div>

      <div className="mt-5 border-t border-white/25 pt-4">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold">
          <span className="text-[#777587]">{detailLabel}</span>
          <span className="text-[#0b1c30]">{progressLabel || detailValue}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/35 shadow-[inset_0_1px_2px_rgba(27,36,84,0.12)]">
          <div className={`h-full rounded-full transition-all duration-500 ${progressLineClass}`} style={{ width: `${normalizedProgress}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-[#777587]">
          <span>{detailValue}</span>
          <span className={complete ? "text-[#006c49]" : "text-[#464555]"}>{normalizedProgress}%</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onConfigure}
        className={`mt-5 flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-[#3525cd] transition hover:bg-white/45 ${glassButton}`}
      >
        Configure
        <ChevronRight size={16} />
      </button>
    </article>
  );
}

function TechnicalPanel({ midtrans, xendit, telegram, apeEpi }) {
  const deliveries = [
    {
      event: "payment.notification",
      service: "Midtrans",
      status: midtrans.enabled ? "Delivered" : "Paused",
      tone: midtrans.enabled ? "mint" : "gold"
    },
    {
      event: "xendit.notification",
      service: "Xendit",
      status: xendit.enabled ? "Delivered" : "Paused",
      tone: xendit.enabled ? "mint" : "gold"
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
            <tr className="border-b border-white/25 text-[11px] font-semibold uppercase tracking-wide text-[#464555]">
              <th className="pb-3">Event</th>
              <th className="pb-3">Service</th>
              <th className="pb-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((item) => (
              <tr key={item.event} className="border-b border-white/15 text-sm font-semibold last:border-0">
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
      className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/40 bg-white/35 text-sm font-semibold text-[#3525cd] shadow-[0_14px_30px_rgba(27,36,84,0.16),inset_1px_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl"
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
                    <p className="mt-1 text-3xl font-bold text-[#0b1c30]">{item.value}</p>
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
              <h3 className="text-xl font-semibold text-white">Data Residency Compliant</h3>
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
            <h2 className="text-xl font-semibold text-[#0b1c30]">Recent Activity Items</h2>
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
                    <h3 className={`text-sm font-semibold ${tone === "coral" ? "text-[#ba1a1a]" : "text-[#0b1c30]"}`}>{log.action}</h3>
                    <span className="text-xs font-semibold text-[#777587]">{new Date(log.created_at).toLocaleString("id-ID")}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium leading-6 text-[#464555]">
                    Admin <span className="font-semibold text-[#3525cd]">{log.admin_email || "system"}</span>
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
      className={`flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-lg border border-white/25 bg-gradient-to-br px-4 text-sm font-semibold text-white shadow-[0_18px_42px_rgba(27,36,84,0.18),inset_1px_1px_0_rgba(255,255,255,0.34)] transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60 sm:w-auto ${bg}`}
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

function hasText(value) {
  return String(value || "").trim().length > 0;
}

function hasPositiveNumber(value) {
  return Number(value) > 0;
}

function hasNonNegativeNumber(value) {
  return value !== "" && value !== null && value !== undefined && Number(value) >= 0;
}

function hasSecret(setting, field) {
  return hasText(setting?.[field]) || Boolean(setting?.[`${field}_configured`]);
}

function integrationProgress(requirements) {
  const total = requirements.length;
  const done = requirements.filter((item) => Boolean(item)).length;
  return {
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100)
  };
}

function integrationProgressLabel(progress) {
  if (progress.percent === 100) return "Lengkap";
  if (progress.done === 0) return "Belum diatur";
  return `${progress.done}/${progress.total} lengkap`;
}

function paymentTone(status) {
  if (status === "paid") return "mint";
  if (status === "failed" || status === "rejected") return "coral";
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

function relativeTimeLabel(value) {
  if (!value) return "";
  const hours = (Date.now() - new Date(value).getTime()) / (1000 * 60 * 60);
  if (hours < 1) return "kurang dari 1 jam lalu";
  if (hours < 24) return `${Math.floor(hours)} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

function ApeAssetStatus({ label, data, tone }) {
  return (
    <div>
      <div className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${tone}`}>
        {label}
        {data.stale && (
          <span className="rounded-full bg-coral-light px-1.5 py-0.5 text-[10px] font-bold text-coral">⚠ Belum sinkron terbaru</span>
        )}
      </div>
      <div className="mt-1 text-sm font-semibold text-navy">{fmtRp(Number(data.price_per_gram || 0))} / gram</div>
      <div className="text-[11px] font-semibold text-neutral-500">
        Sinkron terakhir: {formatFetchedAt(data.fetched_at)} ({relativeTimeLabel(data.fetched_at)})
      </div>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function HouseholdDetailModal({ householdId, canManageRoles, onClose, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedPlan, setSelectedPlan] = useState(MANUAL_PAYMENT_PLANS[0].value);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [changingRoleId, setChangingRoleId] = useState("");

  useEffect(() => {
    if (!householdId) return;
    let cancelled = false;
    setDetail(null);
    setError("");
    setMessage("");
    setConfirming(false);
    setLoading(true);
    getAdminHouseholdDetail(householdId)
      .then((data) => { if (!cancelled) setDetail(data); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [householdId]);

  async function handleChangeMemberRole(memberId, role) {
    setChangingRoleId(memberId);
    try {
      await updateAdminUserRole(memberId, role);
      const refreshed = await getAdminHouseholdDetail(householdId);
      setDetail(refreshed);
      onChanged?.();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setChangingRoleId("");
    }
  }

  async function handleRecordPayment() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      await recordManualPayment(householdId, selectedPlan);
      const refreshed = await getAdminHouseholdDetail(householdId);
      setDetail(refreshed);
      setMessage("Pembayaran manual berhasil dicatat.");
      onChanged?.();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSubmitting(false);
      setConfirming(false);
    }
  }

  return (
    <Dialog open={Boolean(householdId)} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-[#0b1c30]/40 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-[0_20px_60px_rgba(11,28,48,0.25)]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <DialogTitle className="text-lg font-semibold text-[#0b1c30]">
              {detail?.household?.name || "Detail Household"}
            </DialogTitle>
            <button type="button" onClick={onClose} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[#777587] transition hover:bg-[#eff4ff]">
              <X size={18} />
            </button>
          </div>

          {loading && <div className="py-8 text-center text-sm font-semibold text-[#777587]">Memuat detail...</div>}
          {error && <div className="rounded-lg bg-[#ffdad6] p-3 text-sm font-semibold text-[#ba1a1a]">{error}</div>}

          {detail && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[#777587]">Owner</div>
                  <div className="font-semibold text-[#0b1c30]">{detail.household.owner_name || detail.household.owner_email}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[#777587]">Plan</div>
                  <div className="font-semibold text-[#0b1c30]">{detail.household.plan || "-"}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[#777587]">Status Subscription</div>
                  <StatusBadge tone={detail.household.subscription_status === "active" ? "mint" : "gold"}>
                    {detail.household.subscription_status || "unknown"}
                  </StatusBadge>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[#777587]">Aktif Hingga</div>
                  <div className="font-semibold text-[#0b1c30]">{formatDate(detail.household.current_period_end)}</div>
                </div>
              </div>

              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#777587]">
                  Member ({detail.members.length})
                </div>
                <div className="space-y-2">
                  {detail.members.map((m) => (
                    <div key={m.id} className="flex flex-col gap-2 rounded-lg bg-[#eff4ff] px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-[#0b1c30]">{m.name || m.email}</div>
                        <div className="truncate text-xs text-[#777587]">{m.email}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <StatusBadge tone="violet">{m.household_role}</StatusBadge>
                        {canManageRoles ? (
                          <select
                            className={`${inputClass} h-9 sm:w-36`}
                            value={m.system_role}
                            disabled={changingRoleId === m.id}
                            onChange={(e) => handleChangeMemberRole(m.id, e.target.value)}
                          >
                            <option value="user">user</option>
                            <option value="admin">admin</option>
                            <option value="super_admin">super_admin</option>
                          </select>
                        ) : (
                          <StatusBadge tone={m.effective_role === "super_admin" ? "navy" : m.effective_role === "admin" ? "violet" : "mint"}>
                            {m.effective_role}
                          </StatusBadge>
                        )}
                      </div>
                    </div>
                  ))}
                  {detail.members.length === 0 && <div className="text-sm text-[#777587]">Tidak ada member.</div>}
                </div>
              </div>

              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#777587]">
                  Riwayat Payment ({detail.payments.length})
                </div>
                <div className="max-h-40 space-y-2 overflow-y-auto">
                  {detail.payments.map((p) => (
                    <div key={p.order_id} className="flex items-center justify-between rounded-lg bg-[#eff4ff] px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-[#0b1c30]">{p.plan} · {fmtRp(p.amount)}</div>
                        <div className="text-xs text-[#777587]">{formatDate(p.created_at)}</div>
                      </div>
                      <StatusBadge tone={paymentTone(p.status)}>{p.status}</StatusBadge>
                    </div>
                  ))}
                  {detail.payments.length === 0 && <div className="text-sm text-[#777587]">Belum ada payment.</div>}
                </div>
              </div>

              <div className="rounded-xl border border-[#c7c4d8] bg-[#eff4ff]/60 p-4">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#777587]">Catat Pembayaran Manual</div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    className={`${inputClass} sm:max-w-[220px]`}
                    value={selectedPlan}
                    onChange={(e) => { setSelectedPlan(e.target.value); setConfirming(false); }}
                    disabled={submitting}
                  >
                    {MANUAL_PAYMENT_PLANS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label} — {fmtRp(p.amount)}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleRecordPayment}
                    disabled={submitting}
                    className={`flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-white transition disabled:opacity-60 ${
                      confirming ? "bg-[#ba1a1a]" : "bg-[#3525cd]"
                    }`}
                  >
                    <Save size={15} />
                    {submitting ? "Menyimpan..." : confirming ? "Yakin? Klik untuk konfirmasi" : "Catat Pembayaran"}
                  </button>
                </div>
                {message && <div className="mt-2 text-xs font-semibold text-[#464555]">{message}</div>}
              </div>
            </div>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}

export default function AdminPage({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [overview, setOverview] = useState(null);
  const [settings, setSettings] = useState(null);
  const [users, setUsers] = useState([]);
  const [households, setHouseholds] = useState([]);
  const [payments, setPayments] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [message, setMessage] = useState("");
  const [openHouseholdId, setOpenHouseholdId] = useState(null);
  const [householdQuery, setHouseholdQuery] = useState("");
  const [householdPage, setHouseholdPage] = useState(0);
  const [householdTotal, setHouseholdTotal] = useState(0);
  const [paymentQuery, setPaymentQuery] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("");
  const [paymentPage, setPaymentPage] = useState(0);
  const [paymentTotal, setPaymentTotal] = useState(0);
  const [reviewingOrderId, setReviewingOrderId] = useState("");
  const [paymentMethodFeedback, setPaymentMethodFeedback] = useState(null);

  const [mailketing, setMailketing] = useFormState(settings?.mailketing);
  const [midtrans, setMidtrans, replaceMidtrans] = useFormState(settings?.midtrans);
  const [xendit, setXendit, replaceXendit] = useFormState(settings?.xendit);
  const [paymentGateway, setPaymentGateway, replacePaymentGateway] = useFormState(settings?.payment_gateway);
  const [manualPayment, setManualPayment, replaceManualPayment] = useFormState(settings?.manual_payment);
  const [ai, setAi] = useFormState(settings?.ai);
  const [aiQuota, setAiQuota] = useFormState(settings?.ai_quota);
  const [apeEpi, setApeEpi] = useFormState(settings?.ape_epi);
  const [webPush, setWebPush] = useFormState(settings?.web_push);
  const [telegram, setTelegram] = useFormState(settings?.telegram);
  const [whatsapp, setWhatsapp] = useFormState(settings?.whatsapp);
  const [mailketingTestEmail, setMailketingTestEmail] = useState(user?.email || "");
  const [mailketingTestStatus, setMailketingTestStatus] = useState(null);
  const [mailketingLists, setMailketingLists] = useState([]);
  const [mailketingListStatus, setMailketingListStatus] = useState(null);
  const [apePreview, setApePreview] = useState(null);
  const [apeTestStatus, setApeTestStatus] = useState(null);
  const [apeSyncStatus, setApeSyncStatus] = useState(null);

  const canManageRoles = user?.role === "super_admin";
  const unassignedUsers = users.filter((u) => !u.household_id);

  async function loadAll() {
    setLoading(true);
    setMessage("");
    const results = await Promise.allSettled([
      getAdminOverview(),
      getAdminSettings(),
      getAdminUsers(),
      getAdminHouseholds(householdQuery, PAGE_SIZE, householdPage * PAGE_SIZE),
      getAdminPayments(paymentQuery, paymentStatus, PAGE_SIZE, paymentPage * PAGE_SIZE, paymentMethodFilter),
      getAdminAuditLogs()
    ]);

    const [overviewResult, settingsResult, usersResult, householdsResult, paymentsResult, logsResult] = results;
    const failures = [];

    if (overviewResult.status === "fulfilled") setOverview(overviewResult.value);
    else failures.push(overviewResult.reason?.message || "Gagal mengambil ringkasan admin");

    if (settingsResult.status === "fulfilled") setSettings(settingsResult.value);
    else failures.push(settingsResult.reason?.message || "Gagal mengambil pengaturan admin");

    if (usersResult.status === "fulfilled") setUsers(usersResult.value);
    else failures.push(usersResult.reason?.message || "Gagal mengambil user");

    if (householdsResult.status === "fulfilled") {
      setHouseholds(householdsResult.value.households);
      setHouseholdTotal(householdsResult.value.total);
    } else {
      failures.push(householdsResult.reason?.message || "Gagal mengambil household");
    }

    if (paymentsResult.status === "fulfilled") {
      setPayments(paymentsResult.value.payments);
      setPaymentTotal(paymentsResult.value.total);
    } else {
      failures.push(paymentsResult.reason?.message || "Gagal mengambil pembayaran");
    }

    if (logsResult.status === "fulfilled") setLogs(logsResult.value);
    else failures.push(logsResult.reason?.message || "Gagal mengambil audit log");

    if (failures.length > 0) {
      setMessage([...new Set(failures)].join(" · "));
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    getApeEpiStatus().then(setApeSyncStatus).catch(() => setApeSyncStatus(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadHouseholds(page, query) {
    try {
      const data = await getAdminHouseholds(query, PAGE_SIZE, page * PAGE_SIZE);
      setHouseholds(data.households);
      setHouseholdTotal(data.total);
      setHouseholdPage(page);
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function searchHouseholds(e) {
    e.preventDefault();
    await loadHouseholds(0, householdQuery);
  }

  async function loadPayments(page, query, status, method) {
    try {
      const data = await getAdminPayments(query, status, PAGE_SIZE, page * PAGE_SIZE, method);
      setPayments(data.payments);
      setPaymentTotal(data.total);
      setPaymentPage(page);
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function searchPayments(e) {
    e.preventDefault();
    await loadPayments(0, paymentQuery, paymentStatus, paymentMethodFilter);
  }

  async function changePaymentStatus(status) {
    setPaymentStatus(status);
    await loadPayments(0, paymentQuery, status, paymentMethodFilter);
  }

  async function changePaymentMethodFilter(method) {
    setPaymentMethodFilter(method);
    await loadPayments(0, paymentQuery, paymentStatus, method);
  }

  async function handleReviewPayment(orderId, action) {
    if (action === "reject" && !window.confirm("Tolak klaim pembayaran manual ini?")) return;
    setReviewingOrderId(orderId);
    setMessage("");
    try {
      await reviewManualPayment(orderId, action);
      await loadPayments(paymentPage, paymentQuery, paymentStatus, paymentMethodFilter);
      setMessage(action === "approve" ? "Pembayaran disetujui." : "Pembayaran ditolak.");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setReviewingOrderId("");
    }
  }

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

  async function savePaymentMethodConfig() {
    const active = paymentGateway.active || "midtrans";
    const nextGateway = { ...paymentGateway, active };
    const nextManual = { ...manualPayment, enabled: active === "manual" };
    const nextMidtrans = { ...midtrans, enabled: active === "midtrans" };
    const nextXendit = { ...xendit, enabled: active === "xendit" };

    setSavingKey("payment_method");
    setMessage("");
    setPaymentMethodFeedback({ tone: "info", text: "Menyimpan metode pembayaran..." });
    try {
      const [updatedGateway, updatedManual, updatedMidtrans, updatedXendit] = await Promise.all([
        updateAdminSetting("payment_gateway", nextGateway),
        updateAdminSetting("manual_payment", nextManual),
        updateAdminSetting("midtrans", nextMidtrans),
        updateAdminSetting("xendit", nextXendit),
      ]);

      replacePaymentGateway(updatedGateway);
      replaceManualPayment(updatedManual);
      replaceMidtrans(updatedMidtrans);
      replaceXendit(updatedXendit);

      setSettings((prev) => ({
        ...prev,
        payment_gateway: updatedGateway,
        manual_payment: updatedManual,
        midtrans: updatedMidtrans,
        xendit: updatedXendit,
      }));
      setPaymentMethodFeedback({
        tone: "success",
        text: `Berhasil disimpan. Metode aktif sekarang: ${active === "manual" ? "Transfer Manual" : active === "xendit" ? "Xendit" : "Midtrans"}.`,
      });
      setMessage("Metode pembayaran tersimpan.");
    } catch (err) {
      setPaymentMethodFeedback({
        tone: "error",
        text: err.message || "Gagal menyimpan metode pembayaran.",
      });
      setMessage(err.message);
    } finally {
      setSavingKey("");
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
      getApeEpiStatus().then(setApeSyncStatus).catch(() => {});
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

  async function testMailketing() {
    setSavingKey("mailketing_test");
    setMessage("");
    setMailketingTestStatus(null);
    try {
      const result = await testMailketingEmail(mailketingTestEmail || user?.email || "");
      setMailketingTestStatus({
        tone: "success",
        text: `Test email berhasil dikirim ke ${result.to}. Periksa inbox atau spam.`,
      });
      setMessage("Test email Mailketing berhasil dikirim.");
    } catch (err) {
      setMailketingTestStatus({
        tone: "error",
        text: err.message || "Gagal mengirim test email Mailketing.",
      });
      setMessage(err.message);
    } finally {
      setSavingKey("");
    }
  }

  async function loadMailketingLists() {
    setSavingKey("mailketing_lists");
    setMessage("");
    setMailketingListStatus(null);
    try {
      const lists = await getMailketingLists({ api_token: mailketing.api_token || "" });
      setMailketingLists(lists);
      setMailketingListStatus({
        tone: "success",
        text: lists.length > 0 ? `${lists.length} list Mailketing berhasil dibaca.` : "Tidak ada list Mailketing pada akun ini.",
      });
      setMessage("Daftar list Mailketing berhasil dibaca.");
    } catch (err) {
      setMailketingLists([]);
      setMailketingListStatus({
        tone: "error",
        text: err.message || "Gagal mengambil daftar list Mailketing.",
      });
      setMessage(err.message);
    } finally {
      setSavingKey("");
    }
  }

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
  const scrollToIntegrationSettings = (targetId) => {
    const el = (targetId && document.getElementById(targetId)) || document.getElementById("integration-settings");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const activeAiProvider = ai.provider || "sumopod";
  const aiProgress = integrationProgress([
    ai.enabled,
    hasText(activeAiProvider),
    activeAiProvider === "anthropic" ? hasSecret(ai, "anthropic_api_key") : hasSecret(ai, "sumopod_api_key"),
    activeAiProvider === "anthropic" ? true : hasText(ai.sumopod_base_url),
    activeAiProvider === "anthropic" ? hasText(ai.anthropic_model || ai.model) : hasText(ai.sumopod_model || ai.model),
    hasNonNegativeNumber(aiQuota.trial_insight_total),
    hasNonNegativeNumber(aiQuota.trial_scan_total),
    hasNonNegativeNumber(aiQuota.free_insight_monthly),
    hasNonNegativeNumber(aiQuota.free_scan_monthly),
    hasNonNegativeNumber(aiQuota.paid_insight_daily),
    hasNonNegativeNumber(aiQuota.paid_scan_monthly),
    hasNonNegativeNumber(aiQuota.telegram_chat_daily),
  ]);
  const apeEpiProgress = integrationProgress([
    apeEpi.enabled,
    hasSecret(apeEpi, "api_key"),
    hasText(apeEpi.base_url),
    hasText(apeEpi.level),
    hasText(apeEpi.gold_brand),
    hasText(apeEpi.silver_brand),
    hasPositiveNumber(apeEpi.cache_ttl_minutes),
    hasPositiveNumber(apeEpi.max_daily_requests),
  ]);
  const mailketingProgress = integrationProgress([
    mailketing.enabled,
    hasSecret(mailketing, "api_token"),
    hasText(mailketing.from_email),
    hasText(mailketing.from_name),
    hasText(mailketing.list_id),
  ]);
  const telegramProgress = integrationProgress([
    telegram.enabled,
    hasSecret(telegram, "bot_token"),
    hasText(telegram.bot_username),
    hasSecret(telegram, "n8n_shared_secret"),
  ]);
  const whatsappProgress = integrationProgress([
    whatsapp.enabled,
    hasSecret(whatsapp, "token"),
    hasText(whatsapp.phone_number_id),
    hasSecret(whatsapp, "verify_token"),
    hasText(whatsapp.business_phone),
  ]);
  const webPushProgress = integrationProgress([
    webPush.enabled,
    hasText(webPush.vapid_public_key),
    hasSecret(webPush, "vapid_private_key"),
    hasText(webPush.vapid_subject),
  ]);
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
      progress: aiProgress.percent,
      progressLabel: integrationProgressLabel(aiProgress),
      configId: "integration-ai"
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
      progress: apeEpiProgress.percent,
      progressLabel: integrationProgressLabel(apeEpiProgress),
      configId: "integration-ape-epi"
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
      progress: mailketingProgress.percent,
      progressLabel: integrationProgressLabel(mailketingProgress),
      configId: "integration-mailketing"
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
      progress: telegramProgress.percent,
      progressLabel: integrationProgressLabel(telegramProgress),
      configId: "integration-telegram"
    },
    {
      icon: Phone,
      title: "WhatsApp Cloud API",
      description: "Webhook Meta, link akun, scan struk via WhatsApp, dan auto-reply AI.",
      tone: "mint",
      enabled: whatsapp.enabled,
      onToggle: (v) => setWhatsapp("enabled", v),
      detailLabel: "Phone",
      detailValue: whatsapp.business_phone || "Belum diatur",
      progress: whatsappProgress.percent,
      progressLabel: integrationProgressLabel(whatsappProgress),
      configId: "integration-whatsapp"
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
      progress: webPushProgress.percent,
      progressLabel: integrationProgressLabel(webPushProgress),
      configId: "integration-webpush"
    }
  ];

  return (
    <main className="font-admin relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_8%_5%,rgba(108,248,187,0.42),transparent_28%),radial-gradient(circle_at_90%_10%,rgba(226,223,255,0.78),transparent_30%),radial-gradient(circle_at_78%_82%,rgba(255,218,220,0.62),transparent_32%),linear-gradient(135deg,#f8f9ff_0%,#dce9ff_48%,#f8f9ff_100%)] text-[#0b1c30]">
      <div className="pointer-events-none fixed -left-24 top-24 h-72 w-72 rounded-full bg-[#6cf8bb]/30 blur-3xl" />
      <div className="pointer-events-none fixed right-0 top-20 h-96 w-96 rounded-full bg-[#3525cd]/18 blur-3xl" />
      <div className="pointer-events-none fixed bottom-0 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[#ffb2b9]/30 blur-3xl" />
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-64 flex-col border-r border-white/25 bg-white/18 px-3 py-6 shadow-[18px_0_60px_rgba(27,36,84,0.12),inset_-1px_0_0_rgba(255,255,255,0.35)] backdrop-blur-2xl lg:flex">
        <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-white/75" />
        <button type="button" onClick={() => { window.location.href = "/"; }} className="mb-10 w-full px-2 text-left">
          <div className="flex min-h-[72px] w-full items-center justify-center rounded-2xl border border-white/30 bg-white/30 px-5 py-4 shadow-[inset_1px_1px_0_rgba(255,255,255,0.66),0_18px_40px_rgba(27,36,84,0.12)] backdrop-blur-xl">
            <img src="/images/fine-pro-header.png" alt="FinePro" className="h-12 w-full max-w-[178px] object-contain" />
          </div>
          <div className="mt-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-[#464555]">Admin Dashboard</div>
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
                className={`flex min-h-[46px] w-full items-center gap-3 rounded-lg border-l-4 px-4 text-sm font-semibold transition active:scale-[0.98] ${
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
            className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-4 text-sm font-semibold text-[#ba1a1a] transition hover:bg-white/28"
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
          className="inline-flex min-h-[44px] items-center rounded-xl border border-white/30 bg-white/28 px-3 py-1.5 shadow-[inset_1px_1px_0_rgba(255,255,255,0.66)] backdrop-blur-xl lg:hidden"
          aria-label="FinePro"
        >
          <img src="/images/fine-pro-header.png" alt="FinePro" className="h-8 w-auto max-w-[128px] object-contain" />
        </button>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={loadAll}
            className={`flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#3525cd] transition hover:bg-white/45 ${glassButton}`}
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
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-white/30 px-3 py-1 text-[11px] font-semibold text-[#3525cd] shadow-[inset_1px_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl">
                <ShieldCheck size={13} />
                Admin Console
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#0b1c30] sm:text-3xl">
                {pageTitle}
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-[#464555]">
                {pageSubtitle}
              </p>
            </div>
          </section>

      {message && (
        <div className={`p-3 text-sm font-semibold text-[#0b1c30] ${glassPanel}`}>
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
                className={`flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl px-2 text-xs font-semibold transition active:scale-[0.98] sm:text-sm ${
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

      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#464555]">
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
          <StatCard label="Payment Paid" value={overview?.payments?.paid ?? "-"} icon={WalletCards} tone="violet" />
          <StatCard label="Payment Pending" value={overview?.payments?.pending ?? "-"} icon={CreditCard} tone="gold" />
        </div>
      )}

      {activeTab === "integrations" && settings && (
        <div className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {integrationTiles.map((item) => (
              <IntegrationTile
                key={item.title}
                {...item}
                onConfigure={() => scrollToIntegrationSettings(item.configId)}
              />
            ))}
          </div>

          <TechnicalPanel apeEpi={apeEpi} midtrans={midtrans} xendit={xendit} telegram={telegram} />

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
            id="integration-mailketing"
            icon={Mail}
            title="Mailketing"
            description="Email reset password dan laporan bulanan."
            tone="violet"
            enabled={mailketing.enabled}
            onToggle={(v) => setMailketing("enabled", v)}
            footer={
              <div className="flex flex-col gap-2 sm:flex-row">
                <SaveButton label="Simpan Mailketing" saving={savingKey === "mailketing"} onClick={() => saveSetting("mailketing", mailketing)} />
                <button
                  type="button"
                  onClick={testMailketing}
                  disabled={savingKey === "mailketing_test"}
                  className={`flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-[#3525cd] transition active:scale-[0.98] disabled:opacity-60 sm:w-auto ${glassButton}`}
                >
                  <Mail size={15} />
                  {savingKey === "mailketing_test" ? "Mengirim..." : "Kirim Test"}
                </button>
              </div>
            }
          >
            <div>
              <label className={labelClass}>API Token</label>
              <input className={inputClass} type="password" value={mailketing.api_token || ""} onChange={(e) => setMailketing("api_token", e.target.value)} placeholder={mailketing.api_token_masked || "Token baru"} />
              <SecretHint configured={mailketing.api_token_configured} />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#464555]">List Subscriber Registrasi</label>
                <button
                  type="button"
                  onClick={loadMailketingLists}
                  disabled={savingKey === "mailketing_lists"}
                  className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-[#3525cd] transition active:scale-[0.98] disabled:opacity-60 ${glassButton}`}
                  title="Ambil daftar list Mailketing"
                >
                  <RefreshCw size={13} className={savingKey === "mailketing_lists" ? "animate-spin" : ""} />
                  {savingKey === "mailketing_lists" ? "Memuat" : "Ambil List"}
                </button>
              </div>
              <select className={inputClass} value={mailketing.list_id || ""} onChange={(e) => setMailketing("list_id", e.target.value)}>
                <option value="">Jangan otomatis masukkan subscriber</option>
                {mailketing.list_id && !mailketingLists.some((item) => item.list_id === String(mailketing.list_id)) && (
                  <option value={mailketing.list_id}>List tersimpan #{mailketing.list_id}</option>
                )}
                {mailketingLists.map((item) => (
                  <option key={item.list_id} value={item.list_id}>
                    {item.list_name || `List #${item.list_id}`} (ID {item.list_id})
                  </option>
                ))}
              </select>
              <div className="mt-1.5 text-[11px] font-semibold leading-relaxed text-neutral-500">
                Pilih list tujuan untuk semua user baru yang registrasi, lalu simpan Mailketing.
              </div>
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
            <div>
              <label className={labelClass}>Kirim Test Ke</label>
              <input className={inputClass} type="email" value={mailketingTestEmail} onChange={(e) => setMailketingTestEmail(e.target.value)} placeholder={user?.email || "admin@email.com"} />
              <div className="mt-1.5 text-[11px] font-semibold leading-relaxed text-neutral-500">
                Simpan perubahan Mailketing terlebih dahulu sebelum mengirim test.
              </div>
            </div>
            {mailketingListStatus && (
              <div
                className={`rounded-2xl border px-3 py-2 text-xs font-semibold leading-relaxed ${
                  mailketingListStatus.tone === "success"
                    ? "border-mint/20 bg-mint-light/80 text-mint"
                    : "border-coral/20 bg-coral-light/80 text-coral"
                }`}
                role="status"
                aria-live="polite"
              >
                {mailketingListStatus.text}
              </div>
            )}
            {mailketingTestStatus && (
              <div
                className={`rounded-2xl border px-3 py-2 text-xs font-semibold leading-relaxed ${
                  mailketingTestStatus.tone === "success"
                    ? "border-mint/20 bg-mint-light/80 text-mint"
                    : "border-coral/20 bg-coral-light/80 text-coral"
                }`}
                role="status"
                aria-live="polite"
              >
                {mailketingTestStatus.text}
              </div>
            )}
          </IntegrationCard>

          <section className={`xl:col-span-2 p-4 ${glassCard}`}>
            <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-white/80" />
            <SectionTitle
              icon={WalletCards}
              title="Metode Pembayaran Aktif"
              subtitle="Pilih metode yang dipakai user saat upgrade paket, lalu isi konfigurasinya di tempat yang sama."
              tone="violet"
            />
            <div className="relative z-10 space-y-4">
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  { value: "manual", label: "Transfer Manual", icon: Landmark },
                  { value: "midtrans", label: "Midtrans", icon: CreditCard },
                  { value: "xendit", label: "Xendit", icon: CreditCard },
                ].map((method) => {
                  const Icon = method.icon;
                  const active = (paymentGateway.active || "midtrans") === method.value;
                  return (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => setPaymentGateway("active", method.value)}
                      className={`flex min-h-[50px] items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition active:scale-[0.98] ${
                        active
                          ? "border-white/55 bg-[#3525cd]/90 text-white shadow-[0_16px_34px_rgba(53,37,205,0.22),inset_1px_1px_0_rgba(255,255,255,0.32)]"
                          : "border-white/30 bg-white/28 text-[#26344a] shadow-[inset_1px_1px_0_rgba(255,255,255,0.62)] hover:bg-white/42"
                      }`}
                    >
                      <Icon size={16} />
                      {method.label}
                    </button>
                  );
                })}
              </div>

              {(paymentGateway.active || "midtrans") === "manual" && (
                <div className="space-y-3">
                  <div className={`${glassSoft} px-3 py-2 text-sm font-semibold text-[#0b1c30]`}>
                    Transfer Manual akan menjadi satu-satunya metode aktif setelah disimpan.
                  </div>
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
                </div>
              )}

              {(paymentGateway.active || "midtrans") === "midtrans" && (
                <div className="space-y-3">
                  <FormRow>
                    <div className={`${glassSoft} px-3 py-2 text-sm font-semibold text-[#0b1c30]`}>
                      Midtrans akan menjadi satu-satunya metode aktif setelah disimpan.
                    </div>
                    <div className={`flex items-center justify-between px-3 py-2 ${glassSoft}`}>
                      <span className="text-sm font-semibold text-navy">Production Mode</span>
                      <Toggle checked={Boolean(midtrans.is_production)} onChange={(v) => setMidtrans("is_production", v)} />
                    </div>
                  </FormRow>
                  <FormRow>
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
                  </FormRow>
                </div>
              )}

              {(paymentGateway.active || "midtrans") === "xendit" && (
                <div className="space-y-3">
                  <FormRow>
                    <div className={`${glassSoft} px-3 py-2 text-sm font-semibold text-[#0b1c30]`}>
                      Xendit akan menjadi satu-satunya metode aktif setelah disimpan.
                    </div>
                    <div className={`flex items-center justify-between px-3 py-2 ${glassSoft}`}>
                      <span className="text-sm font-semibold text-navy">Production Mode</span>
                      <Toggle checked={Boolean(xendit.is_production)} onChange={(v) => setXendit("is_production", v)} />
                    </div>
                  </FormRow>
                  <FormRow>
                    <div>
                      <label className={labelClass}>Secret Key</label>
                      <input className={inputClass} type="password" value={xendit.secret_key || ""} onChange={(e) => setXendit("secret_key", e.target.value)} placeholder={xendit.secret_key_masked || "Secret key baru"} />
                      <SecretHint configured={xendit.secret_key_configured} />
                    </div>
                    <div>
                      <label className={labelClass}>Callback Verification Token</label>
                      <input className={inputClass} type="password" value={xendit.callback_verification_token || ""} onChange={(e) => setXendit("callback_verification_token", e.target.value)} placeholder={xendit.callback_verification_token_masked || "Token webhook baru"} />
                      <SecretHint configured={xendit.callback_verification_token_configured} />
                    </div>
                  </FormRow>
                </div>
              )}

              {paymentMethodFeedback && (
                <div
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold leading-relaxed ${
                    paymentMethodFeedback.tone === "success"
                      ? "border-[#006c49]/20 bg-[#6cf8bb]/35 text-[#006c49]"
                      : paymentMethodFeedback.tone === "error"
                      ? "border-[#ba1a1a]/20 bg-[#ffdad6]/70 text-[#ba1a1a]"
                      : "border-[#3525cd]/20 bg-[#e2dfff]/55 text-[#3525cd]"
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  {paymentMethodFeedback.text}
                </div>
              )}
              <SaveButton label="Simpan Metode Pembayaran" saving={savingKey === "payment_method"} onClick={savePaymentMethodConfig} />
            </div>
          </section>

          <IntegrationCard
            id="integration-ai"
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
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-mint">Trial</div>
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
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Free / Expired</div>
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
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet">Paid: Monthly / 6 Bulan / Annual</div>
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
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold">Telegram AI</div>
                <div>
                  <label className={labelClass}>Chat AI / User / Hari</label>
                  <input className={inputClass} type="number" min="0" value={aiQuota.telegram_chat_daily ?? 100} onChange={(e) => setAiQuota("telegram_chat_daily", Number(e.target.value))} />
                </div>
              </div>

              <div className="rounded-xl border border-white/25 bg-[#6cf8bb]/18 p-3 shadow-[inset_1px_1px_0_rgba(255,255,255,0.55)] backdrop-blur-xl">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-mint">WhatsApp AI</div>
                <div>
                  <label className={labelClass}>Chat AI / User / Hari</label>
                  <input className={inputClass} type="number" min="0" value={aiQuota.whatsapp_chat_daily ?? 50} onChange={(e) => setAiQuota("whatsapp_chat_daily", Number(e.target.value))} />
                </div>
              </div>

              <div className={`${glassSoft} px-3 py-2 text-xs font-semibold leading-relaxed text-[#464555]`}>
                Scan otomatis dihitung gabungan dari web, upload file, kamera, Telegram, dan WhatsApp. Insight dihitung dari tombol Analisa Keuangan. Chat AI Telegram dan WhatsApp masing-masing dihitung terpisah per pengguna setiap hari saat pesan teks memicu AI.
              </div>

              <SaveButton label="Simpan Limit AI" saving={savingKey === "ai_quota"} onClick={() => saveSetting("ai_quota", aiQuota)} tone="mint" />
            </div>
          </section>

          <IntegrationCard
            id="integration-ape-epi"
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
                  title="Memicu 1x API call manual ke APE-EPI, memakai kuota harian yang sama dengan auto-sync"
                  className={`flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-[#3525cd] transition active:scale-[0.98] disabled:opacity-60 sm:w-auto ${glassButton}`}
                >
                  <RefreshCw size={15} className={savingKey === "ape_epi_test" ? "animate-spin" : ""} />
                  {savingKey === "ape_epi_test" ? "Menguji..." : "Test Koneksi Manual"}
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

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Status Auto-Sync Sistem</div>
              {apeSyncStatus === null ? (
                <div className="rounded-2xl border border-white/25 bg-white/40 px-3 py-2 text-xs font-semibold text-neutral-500">
                  Memuat status sinkronisasi...
                </div>
              ) : !apeSyncStatus.enabled ? (
                <div className="rounded-2xl border border-gold/20 bg-gold-light/80 px-3 py-2 text-xs font-semibold text-gold">
                  APE-EPI belum aktif — aktifkan dan simpan API Key untuk mulai auto-sync.
                </div>
              ) : !apeSyncStatus.gold || !apeSyncStatus.silver ? (
                <div className="rounded-2xl border border-gold/20 bg-gold-light/80 px-3 py-2 text-xs font-semibold text-gold">
                  Belum ada harga tersinkron. Cron auto-sync berjalan 08:00 &amp; 13:00 WIB, atau klik Test Koneksi Manual.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-neutral-400">Harga Jual (Konsumen)</div>
                    <div className="grid gap-2 rounded-2xl border border-white/25 bg-white/40 p-3 sm:grid-cols-2">
                      {[
                        { label: "GOLDGRAM", data: apeSyncStatus.gold, tone: "text-gold" },
                        { label: "SILVERGRAM", data: apeSyncStatus.silver, tone: "text-violet" },
                      ].map(({ label, data, tone }) => (
                        <ApeAssetStatus key={label} label={label} data={data} tone={tone} />
                      ))}
                    </div>
                  </div>

                  {(apeSyncStatus.gold_buyback || apeSyncStatus.silver_buyback) && (
                    <div>
                      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-neutral-400">Harga Buyback</div>
                      <div className="grid gap-2 rounded-2xl border border-white/25 bg-white/40 p-3 sm:grid-cols-2">
                        {apeSyncStatus.gold_buyback && (
                          <ApeAssetStatus label="GOLDGRAM Buyback" data={apeSyncStatus.gold_buyback} tone="text-gold" />
                        )}
                        {apeSyncStatus.silver_buyback && (
                          <ApeAssetStatus label="SILVERGRAM Buyback" data={apeSyncStatus.silver_buyback} tone="text-violet" />
                        )}
                      </div>
                    </div>
                  )}

                  {(!apeSyncStatus.gold_buyback || !apeSyncStatus.silver_buyback) && (
                    <div className="text-[11px] font-semibold leading-relaxed text-neutral-500">
                      Harga buyback bersifat suplemen untuk estimasi target tabungan — belum semuanya berhasil tersinkron, tidak memengaruhi harga jual di atas.
                    </div>
                  )}
                </div>
              )}
            </div>

            {apeTestStatus && (
              <div
                className={`rounded-2xl border px-3 py-2 text-xs font-semibold leading-relaxed ${
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
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-gold">GOLDGRAM</div>
                  <div className="mt-1 text-sm font-semibold text-navy">{fmtRp(Number(apePreview.gold?.price_per_gram || 0))} / gram</div>
                  <div className="text-[11px] font-semibold text-neutral-500">Diambil {formatFetchedAt(apePreview.gold?.fetched_at)}</div>
                  {apePreview.gold?.date && <div className="text-[10px] font-semibold text-neutral-400">Tanggal harga {apePreview.gold.date}</div>}
                  {apePreview.gold?.query_variant && <div className="text-[10px] font-semibold text-neutral-400">Query {apePreview.gold.query_variant}</div>}
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-violet">SILVERGRAM</div>
                  <div className="mt-1 text-sm font-semibold text-navy">{fmtRp(Number(apePreview.silver?.price_per_gram || 0))} / gram</div>
                  <div className="text-[11px] font-semibold text-neutral-500">Diambil {formatFetchedAt(apePreview.silver?.fetched_at)}</div>
                  {apePreview.silver?.date && <div className="text-[10px] font-semibold text-neutral-400">Tanggal harga {apePreview.silver.date}</div>}
                  {apePreview.silver?.query_variant && <div className="text-[10px] font-semibold text-neutral-400">Query {apePreview.silver.query_variant}</div>}
                </div>
              </div>
            )}
          </IntegrationCard>

          <IntegrationCard
            id="integration-webpush"
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
            id="integration-telegram"
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

          <IntegrationCard
            id="integration-whatsapp"
            icon={Phone}
            title="WhatsApp Cloud API"
            description="Webhook Meta, kirim/terima pesan & gambar, link akun user."
            tone="mint"
            enabled={whatsapp.enabled}
            onToggle={(v) => setWhatsapp("enabled", v)}
            footer={<SaveButton label="Simpan WhatsApp" saving={savingKey === "whatsapp"} onClick={() => saveSetting("whatsapp", whatsapp)} />}
          >
            <div>
              <label className={labelClass}>Token (dari Meta Developer)</label>
              <input className={inputClass} type="password" value={whatsapp.token || ""} onChange={(e) => setWhatsapp("token", e.target.value)} placeholder={whatsapp.token_masked || "EAA..."} />
              <SecretHint configured={whatsapp.token_configured} />
            </div>
            <FormRow>
              <div>
                <label className={labelClass}>Phone Number ID</label>
                <input className={inputClass} value={whatsapp.phone_number_id || ""} onChange={(e) => setWhatsapp("phone_number_id", e.target.value)} placeholder="123456789..." />
              </div>
              <div>
                <label className={labelClass}>Verify Token</label>
                <input className={inputClass} type="password" value={whatsapp.verify_token || ""} onChange={(e) => setWhatsapp("verify_token", e.target.value)} placeholder={whatsapp.verify_token_masked || "String acak"} />
                <SecretHint configured={whatsapp.verify_token_configured} />
              </div>
            </FormRow>
            <div>
              <label className={labelClass}>Nomor Bisnis</label>
              <input className={inputClass} value={whatsapp.business_phone || ""} onChange={(e) => setWhatsapp("business_phone", e.target.value)} placeholder="628xxxxxxxxxx" />
            </div>
          </IntegrationCard>
            </div>
          </section>
        </div>
      )}

      {activeTab === "data" && (
        <div className="space-y-6">
          <div className="grid gap-5">
            <section className={`p-6 ${glassPanel}`}>
              <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-white/80" />
              <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e2dfff] text-[#3525cd]">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-[#0b1c30]">Household Portfolios</h2>
                    <p className="mt-1 text-xs font-semibold text-[#464555]">{householdTotal} workspace tercatat</p>
                  </div>
                </div>
                <form onSubmit={searchHouseholds} className="flex min-w-0 gap-2">
                  <input
                    className="h-10 min-w-0 rounded-full border-0 bg-[#eff4ff] px-4 text-sm font-semibold text-[#0b1c30] outline-none transition placeholder:text-[#777587] focus:bg-white focus:shadow-[0_0_0_3px_rgba(53,37,205,0.12)]"
                    value={householdQuery}
                    onChange={(e) => setHouseholdQuery(e.target.value)}
                    placeholder="Cari household/owner/anggota"
                  />
                  <button className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#3525cd] text-white transition hover:brightness-110" type="submit" title="Cari">
                    <Search size={15} />
                  </button>
                </form>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left">
                  <thead>
                    <tr className="border-b border-[#c7c4d8] text-[11px] font-semibold uppercase tracking-wide text-[#777587]">
                      <th className="pb-3">Household</th>
                      <th className="pb-3">Owner</th>
                      <th className="pb-3">Plan</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Anggota</th>
                      <th className="pb-3">Total Dibayar</th>
                      <th className="pb-3 text-right">Aktif Hingga</th>
                    </tr>
                  </thead>
                  <tbody>
                    {households.map((h) => (
                      <tr
                        key={h.id}
                        onClick={() => setOpenHouseholdId(h.id)}
                        className="cursor-pointer border-b border-[#eff4ff] text-sm font-semibold transition last:border-0 hover:bg-[#eff4ff]"
                      >
                        <td className="max-w-[180px] truncate py-3 text-[#0b1c30]">{h.name}</td>
                        <td className="max-w-[180px] truncate py-3 text-[#464555]">{h.owner_name || h.owner_email}</td>
                        <td className="py-3 text-[#464555]">{h.plan || "trial"}</td>
                        <td className="py-3">
                          <StatusBadge tone={h.subscription_status === "active" ? "mint" : "gold"}>
                            {h.subscription_status || "unknown"}
                          </StatusBadge>
                        </td>
                        <td className="py-3 text-[#464555]">{h.member_count}</td>
                        <td className="py-3 text-[#3525cd]">{fmtRp(h.total_paid)}</td>
                        <td className="py-3 text-right text-[#777587]">{formatDate(h.current_period_end)}</td>
                      </tr>
                    ))}
                    {households.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-sm font-semibold text-[#777587]">Tidak ada household.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <PaginationControls page={householdPage} pageSize={PAGE_SIZE} total={householdTotal} onPageChange={(p) => loadHouseholds(p, householdQuery)} />
            </section>
          </div>

          {unassignedUsers.length > 0 && (
            <section className={`p-4 ${glassPanel}`}>
              <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-white/80" />
              <SectionTitle
                icon={UserCog}
                title="Unassigned Users"
                subtitle={`${unassignedUsers.length} akun belum tergabung ke household mana pun.`}
                tone="gold"
              />
              <div className="flex flex-wrap gap-2">
                {unassignedUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 rounded-full bg-[#eff4ff] px-3 py-1.5 text-xs font-semibold text-[#464555]">
                    <span className="text-[#0b1c30]">{u.name || u.email}</span>
                    <StatusBadge tone={u.effective_role === "super_admin" ? "navy" : u.effective_role === "admin" ? "violet" : "mint"}>
                      {u.effective_role || u.role}
                    </StatusBadge>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className={`p-6 ${glassPanel}`}>
            <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-white/80" />
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <SectionTitle icon={WalletCards} title="Payment Activity" subtitle={`${paymentTotal} transaksi pembayaran`} tone="gold" />
              <form onSubmit={searchPayments} className="flex min-w-0 flex-wrap gap-2">
                <select
                  className={`${inputClass} h-10 w-auto`}
                  value={paymentStatus}
                  onChange={(e) => changePaymentStatus(e.target.value)}
                >
                  <option value="">Semua Status</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="rejected">Rejected</option>
                </select>
                <select
                  className={`${inputClass} h-10 w-auto`}
                  value={paymentMethodFilter}
                  onChange={(e) => changePaymentMethodFilter(e.target.value)}
                >
                  <option value="">Semua Metode</option>
                  <option value="midtrans">Midtrans</option>
                  <option value="xendit">Xendit</option>
                  <option value="manual">Manual</option>
                </select>
                <input
                  className="h-10 min-w-0 rounded-full border-0 bg-[#eff4ff] px-4 text-sm font-semibold text-[#0b1c30] outline-none transition placeholder:text-[#777587] focus:bg-white focus:shadow-[0_0_0_3px_rgba(53,37,205,0.12)]"
                  value={paymentQuery}
                  onChange={(e) => setPaymentQuery(e.target.value)}
                  placeholder="Cari household/owner"
                />
                <button className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#3525cd] text-white transition hover:brightness-110" type="submit" title="Cari">
                  <Search size={15} />
                </button>
              </form>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead>
                  <tr className="border-b border-[#c7c4d8] text-[11px] font-semibold uppercase tracking-wide text-[#777587]">
                    <th className="pb-3">Household</th>
                    <th className="pb-3">Owner</th>
                    <th className="pb-3">Plan</th>
                    <th className="pb-3">Nominal</th>
                    <th className="pb-3">Metode</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Tanggal</th>
                    <th className="pb-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.order_id} className="border-b border-[#eff4ff] text-sm font-semibold last:border-0">
                      <td className="max-w-[160px] truncate py-3 text-[#0b1c30]">{p.household_name}</td>
                      <td className="max-w-[160px] truncate py-3 text-[#464555]">{p.owner_email}</td>
                      <td className="py-3 text-[#464555]">{p.plan}</td>
                      <td className="py-3 text-[#3525cd]">{fmtRp(p.amount)}</td>
                      <td className="py-3 text-[#464555]">
                        {p.method}
                        {p.proof_url && (
                          <a href={mediaUrl(p.proof_url)} target="_blank" rel="noreferrer" className="ml-1.5 text-xs font-semibold text-[#3525cd] underline">
                            bukti
                          </a>
                        )}
                      </td>
                      <td className="py-3">
                        <StatusBadge tone={paymentTone(p.status)}>{p.status}</StatusBadge>
                      </td>
                      <td className="py-3 text-[#777587]">{formatDate(p.created_at)}</td>
                      <td className="py-3 text-right">
                        {p.method === "manual" && p.status === "pending" && (
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={reviewingOrderId === p.order_id}
                              onClick={() => handleReviewPayment(p.order_id, "approve")}
                              className="rounded-full bg-[#3525cd] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={reviewingOrderId === p.order_id}
                              onClick={() => handleReviewPayment(p.order_id, "reject")}
                              className="rounded-full bg-[#ba1a1a] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-sm font-semibold text-[#777587]">Belum ada payment.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls page={paymentPage} pageSize={PAGE_SIZE} total={paymentTotal} onPageChange={(p) => loadPayments(p, paymentQuery, paymentStatus, paymentMethodFilter)} />
          </section>
        </div>
      )}

      {activeTab === "audit" && (
        <AuditDashboard logs={logs} />
      )}
        </div>
      </section>

      {openHouseholdId && (
        <HouseholdDetailModal
          householdId={openHouseholdId}
          canManageRoles={canManageRoles}
          onClose={() => setOpenHouseholdId(null)}
          onChanged={loadAll}
        />
      )}
    </main>
  );
}
