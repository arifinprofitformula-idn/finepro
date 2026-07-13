// src/pages/AccountPage.jsx
import { useState, useEffect } from "react";
import { HOUSEHOLD_TYPE_LABELS } from "../api/households.js";
import { createInvite, acceptInvite } from "../api/invites.js";
import { createPayment, getPaymentHistory, getPaymentMethods, PAYMENT_STATUS_LABELS, PLANS } from "../api/payments.js";
import { uploadAvatar, updateProfile } from "../api/auth.js";
import { planLabel } from "../api/subscriptions.js";
import { subscribeToPush, getPushPermissionState } from "../api/push.js";
import { fmtRp } from "../utils/format.js";
import { mediaUrl } from "../utils/media.js";
import {
  Bell,
  Crown,
  Mail,
  Receipt,
  ShieldCheck,
  User,
  UserPlus
} from "lucide-react";

const inputClass =
  "h-11 w-full min-w-0 rounded-full border border-neutral-border bg-white/70 px-4 text-sm font-medium text-navy outline-none backdrop-blur";
const primaryBtnClass =
  "flex h-11 items-center justify-center gap-1.5 rounded-full bg-violet px-4 text-sm font-bold text-white disabled:opacity-60";

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
  const [acceptingId, setAcceptingId] = useState(null);
  const [payingPlan, setPayingPlan] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState(null);
  const [pushPermission, setPushPermission] = useState("default");
  const [pushSubscribing, setPushSubscribing] = useState(false);
  const [pushMsg, setPushMsg] = useState("");

  const isOwner = household.role === "owner";

  useEffect(() => {
    getPaymentHistory().then(setPaymentHistory).catch(() => setPaymentHistory([]));
    getPaymentMethods().then(setPaymentMethods).catch(() => setPaymentMethods({ midtrans: { enabled: false } }));
    getPushPermissionState().then(setPushPermission);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setProfileName(user.name || "");
  }, [user.name]);

  async function handleEnablePush() {
    setPushSubscribing(true);
    setPushMsg("");
    try {
      await subscribeToPush();
      setPushMsg("Notifikasi budget aktif.");
      setPushPermission("granted");
    } catch (err) {
      setPushMsg(err.message);
    } finally {
      setPushSubscribing(false);
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
      await createInvite(inviteEmail);
      setInviteEmail("");
      setInviteMsg("Undangan terkirim. Anggota bisa menerimanya setelah login/daftar dengan email tersebut.");
      setInviteMsgType("success");
    } catch (err) {
      setInviteMsg(err.message);
      setInviteMsgType("error");
    } finally {
      setInviteLoading(false);
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
        <p className="text-xs text-neutral-500">Plan saat ini: {planLabel(household)}</p>
        <p className="text-xs text-neutral-500">
          Tipe: {HOUSEHOLD_TYPE_LABELS[household.household_type] || household.household_type}
        </p>

        {pushPermission !== "granted" && pushPermission !== "unsupported" && (
          <button type="button" onClick={handleEnablePush} disabled={pushSubscribing} className={`${primaryBtnClass} mt-3 w-full`}>
            <Bell size={15} />
            {pushSubscribing ? "Mengaktifkan..." : "Aktifkan Notifikasi Budget"}
          </button>
        )}
        {pushPermission === "granted" && <p className="mt-3 text-xs font-medium text-mint">✓ Notifikasi budget aktif</p>}
        {pushMsg && <p className="mt-1 text-xs text-neutral-500">{pushMsg}</p>}
      </div>

      {/* Upgrade Paket (owner only) */}
      {isOwner && (
        <div className="gloss-panel mb-4 rounded-2xl p-4">
          <SectionHeader icon={Crown} tone="gold" title="Upgrade Paket" />
          <p className="mb-2 text-xs text-neutral-500">Pembayaran diproses via Midtrans, otomatis aktif setelah bayar.</p>
          <div className={`mb-3 flex items-start gap-2 rounded-2xl p-3 text-xs font-semibold ${
            paymentMethods?.midtrans?.enabled ? "bg-mint-light text-mint" : "bg-gold-light text-gold"
          }`}>
            <ShieldCheck size={15} className="mt-0.5 flex-shrink-0" />
            <span>
              {paymentMethods === null
                ? "Memeriksa konfigurasi Midtrans..."
                : paymentMethods?.midtrans?.enabled
                ? "Midtrans Snap aktif. Pilih paket untuk membuka metode pembayaran."
                : "Midtrans belum aktif. Admin perlu mengisi Server Key dan Client Key di Admin Console."}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {PLANS.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-2xl bg-white/70 p-3">
                <div>
                  <div className="text-sm font-semibold text-navy">{p.label}</div>
                  <div className="text-xs text-neutral-500">{p.priceLabel}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleUpgrade(p.id)}
                  disabled={payingPlan === p.id || !paymentMethods?.midtrans?.enabled}
                  className="flex h-10 items-center justify-center rounded-full bg-gold px-4 text-xs font-bold text-white disabled:opacity-60"
                >
                  {payingPlan === p.id ? "Membuka..." : "Pilih"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
                <div className={`text-xs font-medium ${p.status === "paid" ? "text-mint" : p.status === "failed" ? "text-coral" : "text-gold"}`}>
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
