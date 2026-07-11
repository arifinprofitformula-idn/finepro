// src/pages/AccountPage.jsx
import { useState, useEffect } from "react";
import { updateMonthlyIncomeDay, HOUSEHOLD_TYPE_LABELS } from "../api/households.js";
import { createInvite, acceptInvite } from "../api/invites.js";
import { createPayment, getPaymentHistory, PAYMENT_STATUS_LABELS, PLANS } from "../api/payments.js";
import { exportMonthCSV, exportMonthPDF } from "../api/transactions.js";
import { getBills, createBill, markBillPaid, deleteBill } from "../api/bills.js";
import { getArisanGroups, createArisanGroup } from "../api/arisan.js";
import ArisanGroupCard from "../components/ArisanGroupCard.jsx";
import WalletCard from "../components/WalletCard.jsx";
import CategoryRow from "../components/CategoryRow.jsx";
import { useWallets } from "../hooks/useWallets.js";
import { uploadAvatar } from "../api/auth.js";
import { planLabel } from "../api/subscriptions.js";
import { subscribeToPush, getPushPermissionState } from "../api/push.js";
import { fmtRp, monthKey, todayStr } from "../utils/format.js";
import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Bell,
  CalendarClock,
  Crown,
  Download,
  LogOut,
  Mail,
  Receipt,
  Tag,
  User,
  UserPlus,
  Users,
  Wallet
} from "lucide-react";

const inputClass =
  "h-11 w-full min-w-0 rounded-full border border-neutral-border bg-white/70 px-4 text-sm font-medium text-navy outline-none backdrop-blur";
const primaryBtnClass =
  "flex h-11 items-center justify-center gap-1.5 rounded-full bg-violet px-4 text-sm font-bold text-white disabled:opacity-60";
const outlineBtnClass =
  "flex h-11 items-center justify-center gap-1.5 rounded-full border border-navy px-4 text-sm font-bold text-navy disabled:opacity-60";

const TONE_CLASS = {
  violet: "bg-violet-light text-violet",
  gold: "bg-gold-light text-gold",
  mint: "bg-mint-light text-mint",
  coral: "bg-coral-light text-coral"
};

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
  categoriesExpense,
  categoriesIncome,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
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
  const [pdfLoading, setPdfLoading] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [bills, setBills] = useState([]);
  const [billName, setBillName] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billDueDate, setBillDueDate] = useState("");
  const [billRecurring, setBillRecurring] = useState(false);
  const [billSaving, setBillSaving] = useState(false);
  const [billMsg, setBillMsg] = useState("");
  const [billMsgType, setBillMsgType] = useState("");
  const [billBusyId, setBillBusyId] = useState(null);
  const { wallets, createWallet: addWallet, transfer: transferWallets } = useWallets(household.id);
  const [newWalletName, setNewWalletName] = useState("");
  const [walletSaving, setWalletSaving] = useState(false);
  const [transferFrom, setTransferFrom] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferMsg, setTransferMsg] = useState("");
  const [transferMsgType, setTransferMsgType] = useState("");
  const [arisanGroups, setArisanGroups] = useState([]);
  const [arisanName, setArisanName] = useState("");
  const [arisanAmount, setArisanAmount] = useState("");
  const [arisanFrequency, setArisanFrequency] = useState("Bulanan");
  const [arisanSaving, setArisanSaving] = useState(false);
  const [pushPermission, setPushPermission] = useState("default");
  const [pushSubscribing, setPushSubscribing] = useState(false);
  const [pushMsg, setPushMsg] = useState("");
  const [categoryTab, setCategoryTab] = useState("expense");
  const [newCategoryType, setNewCategoryType] = useState("expense");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);

  const isOwner = household.role === "owner";
  const isStudent = household.household_type === "student";

  useEffect(() => {
    getPaymentHistory().then(setPaymentHistory).catch(() => setPaymentHistory([]));
    refreshBills();
    refreshArisan();
    getPushPermissionState().then(setPushPermission);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (wallets.length >= 2) {
      setTransferFrom((prev) => prev || wallets[0].id);
      setTransferTo((prev) => prev || wallets[1].id);
    }
  }, [wallets]);

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

  async function refreshArisan() {
    try {
      setArisanGroups(await getArisanGroups());
    } catch {
      setArisanGroups([]);
    }
  }

  async function handleAddArisanGroup(e) {
    e.preventDefault();
    setArisanSaving(true);
    try {
      await createArisanGroup({
        name: arisanName,
        amount_per_period: parseFloat(arisanAmount) || 0,
        frequency_label: arisanFrequency
      });
      setArisanName("");
      setArisanAmount("");
      await refreshArisan();
    } catch (err) {
      alert("Gagal membuat grup arisan: " + err.message);
    } finally {
      setArisanSaving(false);
    }
  }

  function handleArisanGroupDeleted(groupId) {
    setArisanGroups((prev) => prev.filter((g) => g.id !== groupId));
  }

  async function handleAddWallet(e) {
    e.preventDefault();
    setWalletSaving(true);
    try {
      await addWallet(newWalletName);
      setNewWalletName("");
    } catch (err) {
      alert("Gagal membuat dompet: " + err.message);
    } finally {
      setWalletSaving(false);
    }
  }

  async function handleTransfer(e) {
    e.preventDefault();
    setTransferSaving(true);
    setTransferMsg("");
    try {
      await transferWallets({
        from_wallet_id: transferFrom,
        to_wallet_id: transferTo,
        amount: parseFloat(transferAmount) || 0,
        note: transferNote
      });
      setTransferAmount("");
      setTransferNote("");
      setTransferMsg("Transfer berhasil.");
      setTransferMsgType("success");
    } catch (err) {
      setTransferMsg(err.message);
      setTransferMsgType("error");
    } finally {
      setTransferSaving(false);
    }
  }

  async function handleAddCategory(e) {
    e.preventDefault();
    setCategorySaving(true);
    try {
      await onCreateCategory(newCategoryType, newCategoryName);
      setNewCategoryName("");
    } catch (err) {
      alert("Gagal menambah kategori: " + err.message);
    } finally {
      setCategorySaving(false);
    }
  }

  async function refreshBills() {
    try {
      setBills(await getBills());
    } catch {
      setBills([]);
    }
  }

  async function handleAddBill(e) {
    e.preventDefault();
    setBillSaving(true);
    setBillMsg("");
    try {
      await createBill({
        name: billName,
        amount: parseFloat(billAmount) || 0,
        due_date: billDueDate,
        is_recurring: billRecurring
      });
      setBillName("");
      setBillAmount("");
      setBillDueDate("");
      setBillRecurring(false);
      await refreshBills();
    } catch (err) {
      setBillMsg(err.message);
      setBillMsgType("error");
    } finally {
      setBillSaving(false);
    }
  }

  async function handleMarkPaid(id) {
    setBillBusyId(id);
    try {
      await markBillPaid(id);
      await refreshBills();
    } catch (err) {
      alert("Gagal menandai lunas: " + err.message);
    } finally {
      setBillBusyId(null);
    }
  }

  async function handleDeleteBill(id) {
    setBillBusyId(id);
    try {
      await deleteBill(id);
      await refreshBills();
    } catch (err) {
      alert("Gagal menghapus tagihan: " + err.message);
    } finally {
      setBillBusyId(null);
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

  async function handleExportPDF() {
    setPdfLoading(true);
    try {
      await exportMonthPDF(household.id, monthKey(todayStr()));
    } catch (err) {
      alert("Gagal export PDF: " + err.message);
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-5 pb-28">
      {/* Profil */}
      <div className="gloss-panel mb-4 flex items-center gap-3 rounded-2xl p-4">
        <label className="h-14 w-14 flex-shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-white bg-violet text-white shadow-soft flex items-center justify-center text-lg font-semibold">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
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

        <button type="button" onClick={onLogout} className={`${outlineBtnClass} mt-3 w-full`}>
          <LogOut size={15} />
          Keluar
        </button>
      </div>

      {/* Upgrade Paket (owner only) */}
      {isOwner && (
        <div className="gloss-panel mb-4 rounded-2xl p-4">
          <SectionHeader icon={Crown} tone="gold" title="Upgrade Paket" />
          <p className="mb-2 text-xs text-neutral-500">Pembayaran diproses via Midtrans, otomatis aktif setelah bayar.</p>
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
                  disabled={payingPlan === p.id}
                  className="flex h-10 items-center justify-center rounded-full bg-gold px-4 text-xs font-bold text-white disabled:opacity-60"
                >
                  Pilih
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

      {/* Export */}
      <div className="gloss-panel mb-4 rounded-2xl p-4">
        <SectionHeader icon={Download} tone="mint" title="Export Data" />
        <p className="mb-2 text-xs text-neutral-500">Unduh transaksi bulan berjalan.</p>
        <div className="flex gap-2">
          <button type="button" onClick={handleExportCSV} disabled={exportLoading} className={`${primaryBtnClass} flex-1`}>
            {exportLoading ? "..." : "CSV"}
          </button>
          <button type="button" onClick={handleExportPDF} disabled={pdfLoading} className={`${outlineBtnClass} flex-1`}>
            {pdfLoading ? "Menyiapkan..." : "PDF"}
          </button>
        </div>
      </div>

      {/* Dompet & Transfer */}
      <div className="gloss-panel mb-4 rounded-2xl p-4">
        <SectionHeader icon={Wallet} tone="violet" title="Dompet" />
        {wallets.map((w) => (
          <WalletCard key={w.id} wallet={w} />
        ))}

        <form onSubmit={handleAddWallet} className="mt-3 flex gap-2">
          <label htmlFor="new-wallet" className="sr-only">Nama dompet baru</label>
          <input
            id="new-wallet"
            type="text"
            required
            value={newWalletName}
            onChange={(e) => setNewWalletName(e.target.value)}
            placeholder="Nama dompet baru, mis. BCA"
            className={`${inputClass} flex-1`}
          />
          <button type="submit" disabled={walletSaving} className={primaryBtnClass}>
            Tambah
          </button>
        </form>

        {wallets.length >= 2 && (
          <form onSubmit={handleTransfer} className="mt-4 flex flex-col gap-2 border-t border-neutral-border/60 pt-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500">
              <ArrowRightLeft size={13} />
              Transfer Antar Dompet
            </div>
            <div className="flex gap-2">
              <select value={transferFrom} onChange={(e) => setTransferFrom(e.target.value)} className={inputClass}>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
              <select value={transferTo} onChange={(e) => setTransferTo(e.target.value)} className={inputClass}>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <input
              type="number"
              min="0"
              step="1000"
              required
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              placeholder="Nominal transfer"
              className={inputClass}
            />
            <input
              type="text"
              value={transferNote}
              onChange={(e) => setTransferNote(e.target.value)}
              placeholder="Catatan (opsional)"
              className={inputClass}
            />
            <button type="submit" disabled={transferSaving} className={primaryBtnClass}>
              Transfer
            </button>
            <StatusMsg msg={transferMsg} type={transferMsgType} />
          </form>
        )}
      </div>

      {/* Tagihan & Pengingat Jatuh Tempo */}
      <div className="gloss-panel mb-4 rounded-2xl p-4">
        <SectionHeader icon={Bell} tone="coral" title="Tagihan & Pengingat" />
        <p className="mb-2 text-xs text-neutral-500">
          Catat tagihan rutin/sekali bayar, dapat pengingat di beranda 3 hari sebelum jatuh tempo.
        </p>

        {bills.length > 0 && (
          <div className="mb-3">
            {bills.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-2 border-b border-neutral-border/60 py-2 last:border-0">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-navy">
                    {b.name} {b.is_recurring && <span className="font-normal text-neutral-500">(berulang)</span>}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {fmtRp(b.amount)} · jatuh tempo {b.due_date}
                    {b.paid_at && !b.is_recurring && " · Lunas"}
                  </div>
                </div>
                <div className="flex flex-shrink-0 gap-1.5">
                  {!(b.paid_at && !b.is_recurring) && (
                    <button
                      type="button"
                      onClick={() => handleMarkPaid(b.id)}
                      disabled={billBusyId === b.id}
                      className="flex h-9 items-center justify-center rounded-full bg-mint px-3 text-xs font-bold text-white disabled:opacity-60"
                    >
                      Lunas
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteBill(b.id)}
                    disabled={billBusyId === b.id}
                    className="flex h-9 items-center justify-center rounded-full border border-neutral-border px-3 text-xs font-semibold text-neutral-500 disabled:opacity-60"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAddBill} className="flex flex-col gap-2">
          <label htmlFor="bill-name" className="sr-only">Nama tagihan</label>
          <input
            id="bill-name"
            type="text"
            required
            value={billName}
            onChange={(e) => setBillName(e.target.value)}
            placeholder="Nama tagihan, mis. Listrik"
            className={inputClass}
          />
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="1000"
              required
              value={billAmount}
              onChange={(e) => setBillAmount(e.target.value)}
              placeholder="Nominal"
              className={inputClass}
            />
            <input
              type="date"
              required
              value={billDueDate}
              onChange={(e) => setBillDueDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <label className="flex items-center gap-2 px-1 text-xs text-neutral-500">
            <input type="checkbox" checked={billRecurring} onChange={(e) => setBillRecurring(e.target.checked)} />
            Tagihan berulang tiap bulan
          </label>
          <button type="submit" disabled={billSaving} className={primaryBtnClass}>
            Tambah Tagihan
          </button>
          <StatusMsg msg={billMsg} type={billMsgType} />
        </form>
      </div>

      {/* Tanggal Uang Bulanan (student only) */}
      {isStudent && (
        <div className="gloss-panel mb-4 rounded-2xl p-4">
          <SectionHeader icon={CalendarClock} tone="gold" title="Tanggal Uang Bulanan" />
          <p className="mb-2 text-xs text-neutral-500">
            Atur tanggal biasanya uang kiriman/bulanan cair, supaya dapat pengingat lembut di beranda.
          </p>
          <form onSubmit={handleSaveIncomeDay} className="flex flex-col gap-2">
            <label htmlFor="income-day" className="sr-only">Tanggal uang bulanan (1-31)</label>
            <input
              id="income-day"
              type="number"
              min="1"
              max="31"
              value={monthlyIncomeDayInput}
              onChange={(e) => setMonthlyIncomeDayInput(e.target.value)}
              placeholder="mis. 25"
              className={inputClass}
            />
            <button type="submit" disabled={incomeDaySaving} className={primaryBtnClass}>
              Simpan
            </button>
            <StatusMsg msg={incomeDayMsg} type={incomeDayMsgType} />
          </form>
        </div>
      )}

      {/* Arisan & Iuran */}
      <div className="gloss-panel mb-4 rounded-2xl p-4">
        <SectionHeader icon={Users} tone="mint" title="Arisan & Iuran" />
        <p className="mb-2 text-xs text-neutral-500">Catat setoran & giliran arisan, terpisah dari transaksi rumah tangga biasa.</p>

        {arisanGroups.length > 0 && (
          <div className="mb-3 flex flex-col gap-2">
            {arisanGroups.map((g) => (
              <ArisanGroupCard key={g.id} group={g} onDeleted={handleArisanGroupDeleted} />
            ))}
          </div>
        )}

        <form onSubmit={handleAddArisanGroup} className="flex flex-col gap-2">
          <label htmlFor="arisan-name" className="sr-only">Nama arisan</label>
          <input
            id="arisan-name"
            type="text"
            required
            value={arisanName}
            onChange={(e) => setArisanName(e.target.value)}
            placeholder="Nama arisan, mis. Arisan RT 05"
            className={inputClass}
          />
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="1000"
              required
              value={arisanAmount}
              onChange={(e) => setArisanAmount(e.target.value)}
              placeholder="Iuran per periode"
              className={inputClass}
            />
            <input
              type="text"
              value={arisanFrequency}
              onChange={(e) => setArisanFrequency(e.target.value)}
              placeholder="Bulanan"
              className={inputClass}
            />
          </div>
          <button type="submit" disabled={arisanSaving} className={primaryBtnClass}>
            Buat Grup Arisan
          </button>
        </form>
      </div>

      {/* Kategori — bisa tambah/ubah/hapus, termasuk kategori bawaan sistem */}
      <div className="gloss-panel mb-4 rounded-2xl p-4">
        <SectionHeader icon={Tag} tone="violet" title="Kategori" />

        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setCategoryTab("expense")}
            className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full border text-sm font-semibold ${
              categoryTab === "expense" ? "border-coral bg-coral-light text-coral" : "border-white/80 bg-white/60 text-neutral-500"
            }`}
          >
            <ArrowDownLeft size={15} />
            Pengeluaran
          </button>
          <button
            type="button"
            onClick={() => setCategoryTab("income")}
            className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full border text-sm font-semibold ${
              categoryTab === "income" ? "border-mint bg-mint-light text-mint" : "border-white/80 bg-white/60 text-neutral-500"
            }`}
          >
            <ArrowUpRight size={15} />
            Pemasukan
          </button>
        </div>

        {(categoryTab === "expense" ? categoriesExpense : categoriesIncome).map((c) => (
          <CategoryRow key={c.id} category={c} onRename={onRenameCategory} onDelete={onDeleteCategory} />
        ))}
        {(categoryTab === "expense" ? categoriesExpense : categoriesIncome).length === 0 && (
          <div className="py-2 text-xs font-medium text-neutral-500">Belum ada kategori.</div>
        )}

        <form onSubmit={handleAddCategory} className="mt-3 flex gap-2">
          <label htmlFor="new-category-type" className="sr-only">Tipe kategori baru</label>
          <select
            id="new-category-type"
            value={newCategoryType}
            onChange={(e) => setNewCategoryType(e.target.value)}
            className="h-11 rounded-full border border-neutral-border bg-white/70 px-3 text-sm font-medium text-navy outline-none backdrop-blur"
          >
            <option value="expense">Pengeluaran</option>
            <option value="income">Pemasukan</option>
          </select>
          <label htmlFor="new-category-name" className="sr-only">Nama kategori baru</label>
          <input
            id="new-category-name"
            type="text"
            required
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Nama kategori baru"
            className={`${inputClass} flex-1`}
          />
          <button type="submit" disabled={categorySaving} className={primaryBtnClass}>
            Tambah
          </button>
        </form>
      </div>

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
