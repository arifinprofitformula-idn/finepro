// src/pages/AccountPage.jsx
import { useState, useEffect } from "react";
import { HOUSEHOLD_TYPE_LABELS, getHouseholdMembers, removeHouseholdMember } from "../api/households.js";
import { createInvite, acceptInvite, getSentInvites, resendInvite, cancelInvite } from "../api/invites.js";
import { createPayment, getPaymentHistory, getPaymentMethods, submitManualPayment, PAYMENT_STATUS_LABELS, PLANS } from "../api/payments.js";
import { uploadAvatar, updateProfile } from "../api/auth.js";
import { planLabel } from "../api/subscriptions.js";
import { fmtRp } from "../utils/format.js";
import { mediaUrl } from "../utils/media.js";
import {
  CalendarDays,
  Crown,
  Mail,
  RefreshCw,
  Receipt,
  ShieldCheck,
  User,
  UserMinus,
  UserPlus
} from "lucide-react";

const inputClass =
  "h-11 w-full min-w-0 rounded-full border border-neutral-border bg-white/70 px-4 text-sm font-medium text-navy outline-none backdrop-blur";
const primaryBtnClass =
  "flex h-11 items-center justify-center gap-1.5 rounded-full bg-violet px-4 text-sm font-bold text-white disabled:opacity-60";
const secondaryBtnClass =
  "flex h-9 items-center justify-center gap-1.5 self-start rounded-full border border-violet bg-white/70 px-4 text-xs font-bold text-violet disabled:opacity-60";

const TONE_CLASS = {
  violet: "bg-violet-light text-violet",
  gold: "bg-gold-light text-gold",
  mint: "bg-mint-light text-mint",
  coral: "bg-coral-light text-coral"
};

let snapScriptPromise = null;

function loadSnapScript({ snapUrl, clientKey }) {
  if (!snapUrl || !clientKey) {
    return Promise.reject(new Error("Konfigurasi Midtrans belum lengkap."));
  }

  if (window.snap?.pay) return Promise.resolve(window.snap);

  const existing = document.querySelector(`script[src="${snapUrl}"]`);
  if (existing && snapScriptPromise) return snapScriptPromise;

  snapScriptPromise = new Promise((resolve, reject) => {
    const script = existing || document.createElement("script");
    script.src = snapUrl;
    script.setAttribute("data-client-key", clientKey);
    script.async = true;
    script.onload = () => {
      if (window.snap?.pay) resolve(window.snap);
      else reject(new Error("Midtrans Snap gagal dimuat."));
    };
    script.onerror = () => reject(new Error("Tidak dapat memuat Midtrans Snap."));
    if (!existing) document.body.appendChild(script);
  });

  return snapScriptPromise;
}

function SectionHeader({ icon: Icon, tone, title }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${TONE_CLASS[tone] || TONE_CLASS.violet}`}>
        <Icon size={16} />
      </div>
      <h2 className="text-base font-semibold text-navy">{title}</h2>
    </div>
  );
}

function StatusMsg({ msg, type }) {
  if (!msg) return null;
  return (
    <div className={`mt-2 rounded-xl px-3 py-2 text-xs font-medium ${type === "error" ? "bg-coral-light text-coral" : "bg-mint-light text-mint"}`}>
      {msg}
    </div>
  );
}

function PendingManualReviewCard({ payment, onCancel }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-2 rounded-2xl bg-gold-light p-3 text-xs font-semibold text-gold">
        <ShieldCheck size={15} className="mt-0.5 flex-shrink-0" />
        <span>
          Klaim pembayaran {PLANS.find((pl) => pl.id === payment.plan)?.label || payment.plan} sedang menunggu verifikasi admin
          {payment.created_at ? ` (dikirim ${new Date(payment.created_at).toLocaleDateString("id-ID")})` : ""}. Anda akan bisa berlangganan otomatis setelah disetujui.
        </span>
      </div>
      <button type="button" onClick={onCancel} className={secondaryBtnClass}>
        Kirim Klaim Baru
      </button>
    </div>
  );
}

function formatSubscriptionDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function subscriptionStatusMeta(household) {
  const status = household?.subscription_status || "active";
  const plan = household?.plan || "trial";
  const endDate = household?.current_period_end ? new Date(household.current_period_end) : null;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const endStart = endDate ? new Date(endDate) : null;
  if (endStart) endStart.setHours(0, 0, 0, 0);
  const daysLeft = endStart ? Math.ceil((endStart.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000)) : null;
  const expiringText = daysLeft === 0 ? "hari ini" : `dalam ${daysLeft} hari`;

  if (status === "active") {
    if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 7) {
      return {
        label: plan === "trial" ? "Trial Hampir Habis" : "Akan Berakhir",
        tone: "gold",
        note: `Masa ${plan === "trial" ? "trial" : "langganan"} berakhir ${expiringText}. Perpanjang agar akses tetap aktif.`,
      };
    }

    if (plan === "trial") {
      return {
        label: "Trial Aktif",
        tone: "violet",
        note: daysLeft !== null && daysLeft >= 0 ? `Sisa ${daysLeft} hari trial.` : "Akun sedang dalam masa trial.",
      };
    }
    return {
      label: "Langganan Aktif",
      tone: "mint",
      note: daysLeft !== null && daysLeft >= 0 ? `Sisa ${daysLeft} hari masa aktif.` : "Paket berbayar sedang aktif.",
    };
  }

  if (status === "expired") {
    return {
      label: "Langganan Berakhir",
      tone: "coral",
      note: "Upgrade paket untuk mengaktifkan kembali fitur berbayar.",
    };
  }

  return {
    label: "Belum Aktif",
    tone: "gold",
    note: "Selesaikan pembayaran agar langganan aktif.",
  };
}

function inviteStatusTone(status) {
  if (status === "accepted") return "mint";
  if (status === "cancelled" || status === "expired") return "coral";
  return "gold";
}

function inviteStatusLabel(status) {
  return {
    pending: "Pending",
    accepted: "Diterima",
    expired: "Expired",
    cancelled: "Dibatalkan",
  }[status] || status;
}

export default function AccountPage({
  user,
  household,
  invites,
  onUserUpdated,
  onDataChanged,
  onInvitesChanged
}) {
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileName, setProfileName] = useState(user.name || "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileMsgType, setProfileMsgType] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [inviteMsgType, setInviteMsgType] = useState("");
  const [sentInvites, setSentInvites] = useState([]);
  const [householdMembers, setHouseholdMembers] = useState([]);
  const [inviteActionId, setInviteActionId] = useState("");
  const [memberActionId, setMemberActionId] = useState("");
  const [acceptingId, setAcceptingId] = useState(null);
  const [payingPlan, setPayingPlan] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState(null);
  const [manualPlan, setManualPlan] = useState(PLANS[0].id);
  const [manualReference, setManualReference] = useState("");
  const [manualFile, setManualFile] = useState(null);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualMsg, setManualMsg] = useState("");
  const [manualMsgType, setManualMsgType] = useState("");
  const [showUpgradeForm, setShowUpgradeForm] = useState(false);

  const isOwner = household.role === "owner";
  const subscriptionMeta = subscriptionStatusMeta(household);
  const isActivePaid = household.subscription_status === "active" && household.plan && household.plan !== "trial";
  const pendingManualPayment = paymentHistory.find((p) => p.method === "manual" && p.status === "pending");
  const upgradeMode = isActivePaid && !showUpgradeForm
    ? "confirmed"
    : paymentMethods?.active === "manual" && pendingManualPayment && !showUpgradeForm
    ? "pending_manual"
    : "form";

  useEffect(() => {
    getPaymentHistory().then(setPaymentHistory).catch(() => setPaymentHistory([]));
    getPaymentMethods().then(setPaymentMethods).catch(() => setPaymentMethods({ active: null, midtrans: { enabled: false }, xendit: { enabled: false }, manual: { enabled: false } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setProfileName(user.name || "");
  }, [user.name]);

  useEffect(() => {
    if (!isOwner) return;
    refreshCollaboration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner]);

  async function refreshCollaboration() {
    if (!isOwner) return;
    try {
      const [members, sent] = await Promise.all([
        getHouseholdMembers(),
        getSentInvites(),
      ]);
      setHouseholdMembers(members);
      setSentInvites(sent);
    } catch {
      setHouseholdMembers([]);
      setSentInvites([]);
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const updated = await uploadAvatar(file);
      onUserUpdated(updated);
    } catch (err) {
      alert("Gagal mengunggah foto: " + err.message);
    } finally {
      setAvatarUploading(false);
      e.target.value = "";
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg("");
    setProfileMsgType("");
    try {
      const updated = await updateProfile({ name: profileName });
      onUserUpdated(updated);
      await onDataChanged?.();
      setProfileMsg("Nama pengguna tersimpan.");
      setProfileMsgType("success");
    } catch (err) {
      setProfileMsg(err.message);
      setProfileMsgType("error");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleSendInvite(e) {
    e.preventDefault();
    setInviteLoading(true);
    setInviteMsg("");
    try {
      const invite = await createInvite(inviteEmail);
      setInviteEmail("");
      if (invite.emailSent === false) {
        setInviteMsg(`Undangan dibuat, tetapi email belum terkirim: ${invite.emailError || "konfigurasi email belum siap"}. Anggota tetap bisa menerima setelah login/daftar dengan email tersebut.`);
        setInviteMsgType("error");
      } else {
        setInviteMsg("Undangan terkirim via email. Anggota bisa membuka tautan dan login/daftar dengan email tersebut.");
        setInviteMsgType("success");
      }
      await refreshCollaboration();
    } catch (err) {
      setInviteMsg(err.message);
      setInviteMsgType("error");
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleResendInvite(inviteId) {
    setInviteActionId(inviteId);
    setInviteMsg("");
    try {
      await resendInvite(inviteId);
      setInviteMsg("Email undangan berhasil dikirim ulang.");
      setInviteMsgType("success");
    } catch (err) {
      setInviteMsg(err.message);
      setInviteMsgType("error");
    } finally {
      setInviteActionId("");
    }
  }

  async function handleCancelInvite(inviteId) {
    if (!window.confirm("Batalkan undangan ini?")) return;
    setInviteActionId(inviteId);
    setInviteMsg("");
    try {
      await cancelInvite(inviteId);
      await refreshCollaboration();
      setInviteMsg("Undangan dibatalkan.");
      setInviteMsgType("success");
    } catch (err) {
      setInviteMsg(err.message);
      setInviteMsgType("error");
    } finally {
      setInviteActionId("");
    }
  }

  async function handleRemoveMember(member) {
    if (!window.confirm(`Keluarkan ${member.name || member.email} dari household?`)) return;
    setMemberActionId(member.id);
    setInviteMsg("");
    try {
      await removeHouseholdMember(member.id);
      await refreshCollaboration();
      await onDataChanged?.();
      setInviteMsg("Anggota berhasil dikeluarkan.");
      setInviteMsgType("success");
    } catch (err) {
      setInviteMsg(err.message);
      setInviteMsgType("error");
    } finally {
      setMemberActionId("");
    }
  }

  async function handleAcceptInvite(inviteId) {
    setAcceptingId(inviteId);
    try {
      await acceptInvite(inviteId);
      await onInvitesChanged();
    } catch (err) {
      alert("Gagal menerima undangan: " + err.message);
    } finally {
      setAcceptingId(null);
    }
  }

  async function handleUpgrade(planId) {
    setPayingPlan(planId);
    try {
      if (paymentMethods?.active === "xendit") {
        if (!paymentMethods?.xendit?.enabled) {
          throw new Error("Metode pembayaran Xendit belum aktif. Hubungi admin Fine Pro.");
        }
        const { invoiceUrl } = await createPayment(planId);
        window.location.href = invoiceUrl;
        return;
      }

      if (!paymentMethods?.midtrans?.enabled) {
        throw new Error("Metode pembayaran Midtrans belum aktif. Hubungi admin Fine Pro.");
      }

      const { orderId, token, redirectUrl } = await createPayment(planId);
      const snap = await loadSnapScript(paymentMethods.midtrans);

      snap.pay(token, {
        onSuccess: () => {
          window.location.href = `/payment/finish?order_id=${encodeURIComponent(orderId)}`;
        },
        onPending: () => {
          window.location.href = `/payment/finish?order_id=${encodeURIComponent(orderId)}`;
        },
        onError: () => {
          alert("Pembayaran gagal diproses oleh Midtrans. Silakan coba lagi.");
          setPayingPlan(null);
        },
        onClose: async () => {
          setPayingPlan(null);
          try {
            setPaymentHistory(await getPaymentHistory());
          } catch {
            // Tidak kritis; riwayat akan dimuat ulang saat halaman dibuka kembali.
          }
        }
      });

      if (!window.snap?.pay && redirectUrl) {
        window.location.href = redirectUrl;
      }
    } catch (err) {
      alert("Gagal memulai pembayaran: " + err.message);
      setPayingPlan(null);
    }
  }

  async function handleManualSubmit(e) {
    e.preventDefault();
    if (!manualFile) {
      setManualMsg("Unggah bukti transfer terlebih dahulu.");
      setManualMsgType("error");
      return;
    }
    setManualSubmitting(true);
    setManualMsg("");
    try {
      await submitManualPayment({ plan: manualPlan, reference: manualReference, file: manualFile });
      setManualMsg("Klaim pembayaran terkirim. Admin akan memverifikasi bukti transfer Anda.");
      setManualMsgType("success");
      setManualReference("");
      setManualFile(null);
      setShowUpgradeForm(false);
      setPaymentHistory(await getPaymentHistory());
    } catch (err) {
      setManualMsg(err.message);
      setManualMsgType("error");
    } finally {
      setManualSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-5 pb-28">
      {/* Profil */}
      <div className="gloss-panel mb-4 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <label className="h-14 w-14 flex-shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-white bg-violet text-white shadow-soft flex items-center justify-center text-lg font-semibold">
            {user.avatar_url ? (
              <img src={mediaUrl(user.avatar_url)} alt="" className="h-full w-full object-cover" />
            ) : (
              (user.name || user.email).charAt(0).toUpperCase()
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </label>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-navy">{user.name || user.email}</div>
            <div className="truncate text-xs text-neutral-500">{user.email}</div>
            <div className="mt-0.5 text-xs font-medium text-violet">
              {avatarUploading ? "Mengunggah..." : "Ketuk foto untuk mengganti"}
            </div>
          </div>
        </div>
        <form onSubmit={handleSaveProfile} className="mt-4 flex flex-col gap-2 border-t border-neutral-border/60 pt-3">
          <label htmlFor="profile-name" className="text-xs font-medium text-neutral-500">Nama Pengguna</label>
          <div className="flex gap-2">
            <input
              id="profile-name"
              type="text"
              required
              maxLength={80}
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Nama yang tampil di aplikasi"
              className={`${inputClass} flex-1`}
            />
            <button type="submit" disabled={profileSaving} className={primaryBtnClass}>
              {profileSaving ? "..." : "Simpan"}
            </button>
          </div>
          <StatusMsg msg={profileMsg} type={profileMsgType} />
        </form>
      </div>

      {/* Akun & Langganan */}
      <div className="gloss-panel mb-4 rounded-2xl p-4">
        <SectionHeader icon={User} tone="violet" title="Akun & Langganan" />
        <div className="rounded-2xl bg-white/70 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Status Langganan</div>
              <div className="mt-1 text-sm font-semibold text-navy">{planLabel(household)}</div>
            </div>
            <div className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${TONE_CLASS[subscriptionMeta.tone]}`}>
              <ShieldCheck size={12} />
              {subscriptionMeta.label}
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl bg-white/75 p-3">
              <div className="text-[11px] font-medium text-neutral-500">Tipe Akun</div>
              <div className="mt-1 text-sm font-semibold text-navy">
                {HOUSEHOLD_TYPE_LABELS[household.household_type] || household.household_type}
              </div>
            </div>
            <div className="rounded-2xl bg-white/75 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-500">
                <CalendarDays size={12} />
                Aktif Hingga
              </div>
              <div className="mt-1 text-sm font-semibold text-navy">
                {formatSubscriptionDate(household.current_period_end)}
              </div>
            </div>
          </div>

          <p className={`mt-3 rounded-2xl px-3 py-2 text-xs font-medium ${TONE_CLASS[subscriptionMeta.tone]}`}>
            {subscriptionMeta.note}
          </p>
        </div>

        {/* Action zone: berubah bentuk sesuai state — tombol perpanjang, status klaim manual, atau form pilih paket */}
        {isOwner && (
          <div className="mt-3 border-t border-neutral-border/60 pt-3">
            {upgradeMode === "confirmed" && (
              <button type="button" onClick={() => setShowUpgradeForm(true)} className={secondaryBtnClass}>
                <Crown size={14} />
                Perpanjang / Ganti Paket
              </button>
            )}

            {upgradeMode === "pending_manual" && (
              <PendingManualReviewCard payment={pendingManualPayment} onCancel={() => setShowUpgradeForm(true)} />
            )}

            {upgradeMode === "form" && (
              <>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-neutral-500">
                  <Crown size={13} />
                  {paymentMethods?.active === "manual" ? "Upgrade Paket — Transfer Manual" : "Upgrade Paket"}
                </div>

                {paymentMethods?.active === "manual" ? (
                  paymentMethods?.manual?.enabled ? (
                    <>
                      <div className="mb-3 rounded-2xl bg-white/70 p-3 text-xs text-navy">
                        <div className="font-semibold">{paymentMethods.manual.bank_name}</div>
                        <div>No. Rekening: <span className="font-semibold">{paymentMethods.manual.account_number}</span></div>
                        <div>a.n. {paymentMethods.manual.account_name}</div>
                        {paymentMethods.manual.instructions && (
                          <p className="mt-2 text-neutral-500">{paymentMethods.manual.instructions}</p>
                        )}
                      </div>
                      <form onSubmit={handleManualSubmit} className="flex flex-col gap-2">
                        <label htmlFor="manual-plan" className="text-xs font-medium text-neutral-500">Pilih Paket</label>
                        <select
                          id="manual-plan"
                          className={inputClass}
                          value={manualPlan}
                          onChange={(e) => setManualPlan(e.target.value)}
                        >
                          {PLANS.map((p) => (
                            <option key={p.id} value={p.id}>{p.label} — {p.priceLabel}</option>
                          ))}
                        </select>
                        <label htmlFor="manual-reference" className="text-xs font-medium text-neutral-500">No. Referensi / Berita Transfer (opsional)</label>
                        <input
                          id="manual-reference"
                          type="text"
                          className={inputClass}
                          value={manualReference}
                          onChange={(e) => setManualReference(e.target.value)}
                          placeholder="Contoh: 4 digit terakhir rekening pengirim"
                        />
                        <label htmlFor="manual-proof" className="text-xs font-medium text-neutral-500">Bukti Transfer</label>
                        <input
                          id="manual-proof"
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => setManualFile(e.target.files[0] || null)}
                          className="text-xs"
                        />
                        <button type="submit" disabled={manualSubmitting} className={`${primaryBtnClass} mt-1`}>
                          {manualSubmitting ? "Mengirim..." : "Kirim Klaim Pembayaran"}
                        </button>
                        <StatusMsg msg={manualMsg} type={manualMsgType} />
                      </form>
                    </>
                  ) : (
                    <div className="flex items-start gap-2 rounded-2xl bg-gold-light p-3 text-xs font-semibold text-gold">
                      <ShieldCheck size={15} className="mt-0.5 flex-shrink-0" />
                      <span>Transfer manual belum aktif. Hubungi admin Fine Pro.</span>
                    </div>
                  )
                ) : (
                  <>
                    <p className="mb-2 text-xs text-neutral-500">
                      {paymentMethods?.active === "xendit"
                        ? "Pembayaran diproses via Xendit, otomatis aktif setelah bayar."
                        : "Pembayaran diproses via Midtrans, otomatis aktif setelah bayar."}
                    </p>
                    <div className={`mb-3 flex items-start gap-2 rounded-2xl p-3 text-xs font-semibold ${
                      (paymentMethods?.active === "xendit" ? paymentMethods?.xendit?.enabled : paymentMethods?.midtrans?.enabled)
                        ? "bg-mint-light text-mint" : "bg-gold-light text-gold"
                    }`}>
                      <ShieldCheck size={15} className="mt-0.5 flex-shrink-0" />
                      <span>
                        {paymentMethods === null
                          ? "Memeriksa konfigurasi pembayaran..."
                          : paymentMethods?.active === "xendit"
                          ? (paymentMethods?.xendit?.enabled
                            ? "Xendit aktif. Pilih paket untuk membuka metode pembayaran."
                            : "Xendit belum aktif. Admin perlu mengisi Secret Key di Admin Console.")
                          : (paymentMethods?.midtrans?.enabled
                            ? "Midtrans Snap aktif. Pilih paket untuk membuka metode pembayaran."
                            : "Midtrans belum aktif. Admin perlu mengisi Server Key dan Client Key di Admin Console.")}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {PLANS.map((p) => {
                        const gatewayEnabled = paymentMethods?.active === "xendit" ? paymentMethods?.xendit?.enabled : paymentMethods?.midtrans?.enabled;
                        return (
                          <div key={p.id} className="flex items-center justify-between rounded-2xl bg-white/70 p-3">
                            <div>
                              <div className="text-sm font-semibold text-navy">{p.label}</div>
                              <div className="text-xs text-neutral-500">{p.priceLabel}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleUpgrade(p.id)}
                              disabled={payingPlan === p.id || !gatewayEnabled}
                              className="flex h-10 items-center justify-center rounded-full bg-gold px-4 text-xs font-bold text-white disabled:opacity-60"
                            >
                              {payingPlan === p.id ? "Membuka..." : "Pilih"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {isActivePaid && (
                  <button type="button" onClick={() => setShowUpgradeForm(false)} className={`${secondaryBtnClass} mt-2 border-neutral-border text-neutral-500`}>
                    Batal
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Riwayat Pembayaran */}
      {paymentHistory.length > 0 && (
        <div className="gloss-panel mb-4 rounded-2xl p-4">
          <SectionHeader icon={Receipt} tone="violet" title="Riwayat Pembayaran" />
          {paymentHistory.map((p) => (
            <div key={p.order_id} className="flex items-center justify-between gap-2 border-b border-neutral-border/60 py-2 last:border-0">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-navy">
                  {PLANS.find((pl) => pl.id === p.plan)?.label || p.plan}
                </div>
                <div className="text-xs text-neutral-500">{new Date(p.created_at).toLocaleDateString("id-ID")}</div>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="text-sm font-semibold text-navy">{fmtRp(p.amount)}</div>
                <div className={`text-xs font-medium ${p.status === "paid" ? "text-mint" : p.status === "failed" || p.status === "rejected" ? "text-coral" : "text-gold"}`}>
                  {PAYMENT_STATUS_LABELS[p.status] || p.status}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Undang Anggota (owner only) */}
      {isOwner && (
        <div className="gloss-panel mb-4 rounded-2xl p-4">
          <SectionHeader icon={UserPlus} tone="mint" title="Undang Anggota Keluarga" />
          <form onSubmit={handleSendInvite} className="flex flex-col gap-2">
            <label htmlFor="invite-email" className="sr-only">Email anggota yang diundang</label>
            <input
              id="invite-email"
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="pasangan@email.com"
              className={inputClass}
            />
            <button type="submit" disabled={inviteLoading} className={primaryBtnClass}>
              Kirim Undangan
            </button>
            <StatusMsg msg={inviteMsg} type={inviteMsgType} />
          </form>
          <p className="mt-2 text-xs text-neutral-500">
            Undangan berlaku 7 hari. Anggota bisa menerima lewat halaman ini setelah login/daftar dengan email yang sama.
          </p>

          <div className="mt-4 border-t border-neutral-border/60 pt-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-navy">Anggota Household</div>
              <button type="button" onClick={refreshCollaboration} className="flex h-8 items-center gap-1 rounded-full bg-white/70 px-3 text-xs font-bold text-violet">
                <RefreshCw size={13} />
                Refresh
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {householdMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between gap-2 rounded-2xl bg-white/70 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-navy">{member.name || member.email}</div>
                    <div className="truncate text-xs text-neutral-500">{member.email}</div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${member.role === "owner" ? TONE_CLASS.violet : TONE_CLASS.mint}`}>
                      {member.role === "owner" ? "Owner" : "Member"}
                    </span>
                    {member.role !== "owner" && (
                      <button
                        type="button"
                        disabled={memberActionId === member.id}
                        onClick={() => handleRemoveMember(member)}
                        className="flex h-8 items-center gap-1 rounded-full bg-coral-light px-3 text-xs font-bold text-coral disabled:opacity-60"
                      >
                        <UserMinus size={13} />
                        Keluarkan
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {householdMembers.length === 0 && (
                <div className="rounded-2xl bg-white/70 p-3 text-xs text-neutral-500">Belum ada data anggota.</div>
              )}
            </div>
          </div>

          <div className="mt-4 border-t border-neutral-border/60 pt-3">
            <div className="mb-2 text-sm font-semibold text-navy">Riwayat Undangan</div>
            <div className="flex flex-col gap-2">
              {sentInvites.map((invite) => (
                <div key={invite.id} className="rounded-2xl bg-white/70 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-navy">{invite.invited_email}</div>
                      <div className="text-xs text-neutral-500">
                        Berlaku sampai {new Date(invite.expires_at).toLocaleDateString("id-ID")}
                      </div>
                    </div>
                    <span className={`flex-shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${TONE_CLASS[inviteStatusTone(invite.status)]}`}>
                      {inviteStatusLabel(invite.status)}
                    </span>
                  </div>
                  {invite.status === "pending" && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={inviteActionId === invite.id}
                        onClick={() => handleResendInvite(invite.id)}
                        className="flex h-8 items-center gap-1 rounded-full bg-violet-light px-3 text-xs font-bold text-violet disabled:opacity-60"
                      >
                        <Mail size={13} />
                        Kirim Ulang Email
                      </button>
                      <button
                        type="button"
                        disabled={inviteActionId === invite.id}
                        onClick={() => handleCancelInvite(invite.id)}
                        className="flex h-8 items-center rounded-full bg-coral-light px-3 text-xs font-bold text-coral disabled:opacity-60"
                      >
                        Batalkan
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {sentInvites.length === 0 && (
                <div className="rounded-2xl bg-white/70 p-3 text-xs text-neutral-500">Belum ada undangan terkirim.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Undangan Menunggu */}
      {invites.length > 0 && (
        <div className="gloss-panel mb-4 rounded-2xl p-4">
          <SectionHeader icon={Mail} tone="coral" title="Undangan Menunggu" />
          {invites.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-2 border-b border-neutral-border/60 py-2 last:border-0">
              <div>
                <div className="text-sm font-semibold text-navy">{inv.household_name}</div>
                <div className="text-xs text-neutral-500">Diundang sebagai anggota</div>
              </div>
              <button
                type="button"
                disabled={acceptingId === inv.id}
                onClick={() => handleAcceptInvite(inv.id)}
                className="flex h-10 items-center justify-center whitespace-nowrap rounded-full bg-mint px-3 text-xs font-bold text-white disabled:opacity-60"
              >
                Terima
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
