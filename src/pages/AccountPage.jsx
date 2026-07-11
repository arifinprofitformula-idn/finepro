// src/pages/AccountPage.jsx
import { useState } from "react";
import { updateMonthlyIncomeDay, HOUSEHOLD_TYPE_LABELS } from "../api/households.js";
import { createInvite, acceptInvite } from "../api/invites.js";
import { createPayment, PLANS } from "../api/payments.js";
import { exportMonthCSV } from "../api/transactions.js";
import { uploadAvatar } from "../api/auth.js";
import { planLabel } from "../api/subscriptions.js";
import { monthKey, todayStr } from "../utils/format.js";

export default function AccountPage({
  user,
  household,
  invites,
  paymentPolling,
  paymentStatusMsg,
  onUserUpdated,
  onHouseholdUpdated,
  onInvitesChanged,
  onLogout
}) {
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [monthlyIncomeDayInput, setMonthlyIncomeDayInput] = useState(household.monthly_income_day || "");
  const [incomeDaySaving, setIncomeDaySaving] = useState(false);
  const [incomeDayMsg, setIncomeDayMsg] = useState("");
  const [incomeDayMsgType, setIncomeDayMsgType] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [inviteMsgType, setInviteMsgType] = useState("");
  const [acceptingId, setAcceptingId] = useState(null);
  const [payingPlan, setPayingPlan] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);

  const isOwner = household.role === "owner";
  const isStudent = household.household_type === "student";

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

  async function handleSaveIncomeDay(e) {
    e.preventDefault();
    const day = monthlyIncomeDayInput ? parseInt(monthlyIncomeDayInput, 10) : null;
    if (day !== null && (!Number.isInteger(day) || day < 1 || day > 31)) {
      setIncomeDayMsg("Tanggal harus 1-31.");
      setIncomeDayMsgType("error");
      return;
    }
    setIncomeDaySaving(true);
    setIncomeDayMsg("");
    try {
      const updated = await updateMonthlyIncomeDay(day);
      onHouseholdUpdated(updated);
      setIncomeDayMsg("Tersimpan.");
      setIncomeDayMsgType("success");
    } catch (err) {
      setIncomeDayMsg(err.message);
      setIncomeDayMsgType("error");
    } finally {
      setIncomeDaySaving(false);
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
      const { redirectUrl } = await createPayment(planId);
      window.location.href = redirectUrl;
    } catch (err) {
      alert("Gagal memulai pembayaran: " + err.message);
      setPayingPlan(null);
    }
  }

  async function handleExportCSV() {
    setExportLoading(true);
    try {
      await exportMonthCSV(monthKey(todayStr()));
    } catch (err) {
      alert("Gagal export data: " + err.message);
    } finally {
      setExportLoading(false);
    }
  }

  return (
    <div className="px-4 pt-1 pb-24 max-w-lg mx-auto flex flex-col gap-3">
      {/* Profil */}
      <div className="bg-white border border-neutral-border rounded-xl p-3 flex items-center gap-3">
        <label className="w-14 h-14 rounded-full overflow-hidden bg-navy text-white flex items-center justify-center font-bold text-lg flex-shrink-0 cursor-pointer">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
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
          <div className="text-sm font-bold text-neutral-900 truncate">{user.name || user.email}</div>
          <div className="text-xs text-neutral-500 truncate">{user.email}</div>
          <div className="text-[11px] text-navy mt-0.5">
            {avatarUploading ? "Mengunggah..." : "Ketuk foto untuk mengganti"}
          </div>
        </div>
      </div>

      {/* Akun & Langganan */}
      <div className="bg-white border border-neutral-border rounded-xl p-3">
        <h2 className="text-sm font-semibold text-neutral-900 mb-2">Akun & Langganan</h2>
        <p className="text-xs text-neutral-500">Plan saat ini: {planLabel(household)}</p>
        <p className="text-xs text-neutral-500">
          Tipe: {HOUSEHOLD_TYPE_LABELS[household.household_type] || household.household_type}
        </p>

        {(paymentPolling || paymentStatusMsg) && (
          <div className="mt-2 text-xs rounded-md px-3 py-2 bg-gold/10 text-neutral-900">
            {paymentPolling && "⏳ "}
            {paymentStatusMsg}
          </div>
        )}

        <button
          type="button"
          onClick={onLogout}
          className="w-full min-h-[40px] mt-3 border border-neutral-border rounded-lg text-sm font-semibold text-neutral-900"
        >
          Keluar
        </button>
      </div>

      {/* Upgrade Paket (owner only) */}
      {isOwner && (
        <div className="bg-white border border-neutral-border rounded-xl p-3">
          <h2 className="text-sm font-semibold text-neutral-900 mb-1">Upgrade Paket</h2>
          <p className="text-xs text-neutral-500 mb-2">
            Pembayaran diproses via Midtrans, otomatis aktif setelah bayar.
          </p>
          <div className="flex flex-col gap-2">
            {PLANS.map((p) => (
              <div key={p.id} className="flex items-center justify-between border border-neutral-border rounded-lg p-2.5">
                <div>
                  <div className="text-sm font-bold text-neutral-900">{p.label}</div>
                  <div className="text-xs text-neutral-500">{p.priceLabel}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleUpgrade(p.id)}
                  disabled={payingPlan === p.id}
                  className="min-h-[36px] px-4 rounded-lg bg-navy text-white text-xs font-bold disabled:opacity-60"
                >
                  Pilih
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export */}
      <div className="bg-white border border-neutral-border rounded-xl p-3">
        <h2 className="text-sm font-semibold text-neutral-900 mb-1">Export Data</h2>
        <p className="text-xs text-neutral-500 mb-2">Unduh transaksi bulan berjalan dalam format CSV.</p>
        <button
          type="button"
          onClick={handleExportCSV}
          disabled={exportLoading}
          className="w-full min-h-[40px] bg-navy text-white rounded-lg text-sm font-bold disabled:opacity-60"
        >
          Export CSV Bulan Ini
        </button>
      </div>

      {/* Tanggal Uang Bulanan (student only) */}
      {isStudent && (
        <div className="bg-white border border-neutral-border rounded-xl p-3">
          <h2 className="text-sm font-semibold text-neutral-900 mb-1">Tanggal Uang Bulanan</h2>
          <p className="text-xs text-neutral-500 mb-2">
            Atur tanggal biasanya uang kiriman/bulanan cair, supaya dapat pengingat lembut di beranda.
          </p>
          <form onSubmit={handleSaveIncomeDay} className="flex flex-col gap-2">
            <input
              type="number"
              min="1"
              max="31"
              value={monthlyIncomeDayInput}
              onChange={(e) => setMonthlyIncomeDayInput(e.target.value)}
              placeholder="mis. 25"
              className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-border"
            />
            <button
              type="submit"
              disabled={incomeDaySaving}
              className="min-h-[40px] bg-navy text-white rounded-lg text-sm font-bold disabled:opacity-60"
            >
              Simpan
            </button>
            {incomeDayMsg && (
              <div
                className={`text-xs rounded-md px-3 py-2 ${
                  incomeDayMsgType === "error" ? "bg-danger/10 text-danger" : "bg-success/10 text-success"
                }`}
              >
                {incomeDayMsg}
              </div>
            )}
          </form>
        </div>
      )}

      {/* Kategori custom — backend-nya masih placeholder (lihat api/categories.js addCustomCategory) */}
      <div className="bg-white border border-neutral-border rounded-xl p-3 opacity-60">
        <h2 className="text-sm font-semibold text-neutral-900 mb-1">Kategori Custom</h2>
        <p className="text-xs text-neutral-500">Segera hadir — endpoint backend untuk kategori custom belum tersedia.</p>
      </div>

      {/* Undang Anggota (owner only) */}
      {isOwner && (
        <div className="bg-white border border-neutral-border rounded-xl p-3">
          <h2 className="text-sm font-semibold text-neutral-900 mb-1">Undang Anggota Keluarga</h2>
          <form onSubmit={handleSendInvite} className="flex flex-col gap-2">
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="pasangan@email.com"
              className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-border"
            />
            <button
              type="submit"
              disabled={inviteLoading}
              className="min-h-[40px] bg-navy text-white rounded-lg text-sm font-bold disabled:opacity-60"
            >
              Kirim Undangan
            </button>
            {inviteMsg && (
              <div
                className={`text-xs rounded-md px-3 py-2 ${
                  inviteMsgType === "error" ? "bg-danger/10 text-danger" : "bg-success/10 text-success"
                }`}
              >
                {inviteMsg}
              </div>
            )}
          </form>
          <p className="text-xs text-neutral-500 mt-2">
            Undangan berlaku 7 hari. Anggota bisa menerima lewat halaman ini setelah login/daftar dengan email yang
            sama.
          </p>
        </div>
      )}

      {/* Undangan Menunggu */}
      {invites.length > 0 && (
        <div className="bg-white border border-neutral-border rounded-xl p-3">
          <h2 className="text-sm font-semibold text-neutral-900 mb-1">Undangan Menunggu</h2>
          {invites.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between gap-2 py-2 border-b border-neutral-border last:border-0"
            >
              <div>
                <div className="text-sm font-semibold text-neutral-900">{inv.household_name}</div>
                <div className="text-xs text-neutral-500">Diundang sebagai anggota</div>
              </div>
              <button
                type="button"
                disabled={acceptingId === inv.id}
                onClick={() => handleAcceptInvite(inv.id)}
                className="min-h-[36px] bg-success text-white rounded-md px-3 text-xs font-bold whitespace-nowrap disabled:opacity-60"
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
