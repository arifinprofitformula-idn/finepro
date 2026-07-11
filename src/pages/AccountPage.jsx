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

        {pushPermission !== "granted" && pushPermission !== "unsupported" && (
          <button
            type="button"
            onClick={handleEnablePush}
            disabled={pushSubscribing}
            className="w-full min-h-[40px] mt-3 bg-navy text-white rounded-lg text-sm font-bold disabled:opacity-60"
          >
            {pushSubscribing ? "Mengaktifkan..." : "Aktifkan Notifikasi Budget"}
          </button>
        )}
        {pushPermission === "granted" && (
          <p className="text-xs text-success mt-3">✓ Notifikasi budget aktif</p>
        )}
        {pushMsg && <p className="text-xs text-neutral-500 mt-1">{pushMsg}</p>}

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
                  className="min-h-[40px] px-4 rounded-lg bg-navy text-white text-xs font-bold disabled:opacity-60"
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
        <div className="bg-white border border-neutral-border rounded-xl p-3">
          <h2 className="text-sm font-semibold text-neutral-900 mb-1">Riwayat Pembayaran</h2>
          {paymentHistory.map((p) => (
            <div
              key={p.order_id}
              className="flex items-center justify-between gap-2 py-2 border-b border-neutral-border last:border-0"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-neutral-900 truncate">
                  {PLANS.find((pl) => pl.id === p.plan)?.label || p.plan}
                </div>
                <div className="text-xs text-neutral-500">{new Date(p.created_at).toLocaleDateString("id-ID")}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold text-neutral-900">{fmtRp(p.amount)}</div>
                <div
                  className={`text-xs ${
                    p.status === "paid" ? "text-success" : p.status === "failed" ? "text-danger" : "text-gold"
                  }`}
                >
                  {PAYMENT_STATUS_LABELS[p.status] || p.status}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Export */}
      <div className="bg-white border border-neutral-border rounded-xl p-3">
        <h2 className="text-sm font-semibold text-neutral-900 mb-1">Export Data</h2>
        <p className="text-xs text-neutral-500 mb-2">Unduh transaksi bulan berjalan.</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={exportLoading}
            className="flex-1 min-h-[40px] bg-navy text-white rounded-lg text-sm font-bold disabled:opacity-60"
          >
            {exportLoading ? "..." : "CSV"}
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={pdfLoading}
            className="flex-1 min-h-[40px] border border-navy text-navy rounded-lg text-sm font-bold disabled:opacity-60"
          >
            {pdfLoading ? "Menyiapkan..." : "PDF"}
          </button>
        </div>
      </div>

      {/* Dompet & Transfer */}
      <div className="bg-white border border-neutral-border rounded-xl p-3">
        <h2 className="text-sm font-semibold text-neutral-900 mb-2">Dompet</h2>
        {wallets.map((w) => (
          <WalletCard key={w.id} wallet={w} />
        ))}

        <form onSubmit={handleAddWallet} className="flex gap-2 mt-3">
          <label htmlFor="new-wallet" className="sr-only">Nama dompet baru</label>
          <input
            id="new-wallet"
            type="text"
            required
            value={newWalletName}
            onChange={(e) => setNewWalletName(e.target.value)}
            placeholder="Nama dompet baru, mis. BCA"
            className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-neutral-border"
          />
          <button
            type="submit"
            disabled={walletSaving}
            className="min-h-[40px] px-4 rounded-lg bg-navy text-white text-xs font-bold disabled:opacity-60"
          >
            Tambah
          </button>
        </form>

        {wallets.length >= 2 && (
          <form onSubmit={handleTransfer} className="flex flex-col gap-2 mt-4 pt-3 border-t border-neutral-border">
            <div className="text-xs font-semibold text-neutral-500">Transfer Antar Dompet</div>
            <div className="flex gap-2">
              <select
                value={transferFrom}
                onChange={(e) => setTransferFrom(e.target.value)}
                className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-neutral-border"
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
              <select
                value={transferTo}
                onChange={(e) => setTransferTo(e.target.value)}
                className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-neutral-border"
              >
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
              className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-border"
            />
            <input
              type="text"
              value={transferNote}
              onChange={(e) => setTransferNote(e.target.value)}
              placeholder="Catatan (opsional)"
              className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-border"
            />
            <button
              type="submit"
              disabled={transferSaving}
              className="min-h-[40px] bg-navy text-white rounded-lg text-sm font-bold disabled:opacity-60"
            >
              Transfer
            </button>
            {transferMsg && (
              <div className={`text-xs rounded-md px-3 py-2 ${transferMsgType === "error" ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>
                {transferMsg}
              </div>
            )}
          </form>
        )}
      </div>

      {/* Tagihan & Pengingat Jatuh Tempo */}
      <div className="bg-white border border-neutral-border rounded-xl p-3">
        <h2 className="text-sm font-semibold text-neutral-900 mb-1">Tagihan & Pengingat</h2>
        <p className="text-xs text-neutral-500 mb-2">
          Catat tagihan rutin/sekali bayar, dapat pengingat di beranda 3 hari sebelum jatuh tempo.
        </p>

        {bills.length > 0 && (
          <div className="mb-3">
            {bills.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-2 py-2 border-b border-neutral-border last:border-0">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-neutral-900 truncate">
                    {b.name} {b.is_recurring && <span className="text-neutral-500 font-normal">(berulang)</span>}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {fmtRp(b.amount)} · jatuh tempo {b.due_date}
                    {b.paid_at && !b.is_recurring && " · Lunas"}
                  </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  {!(b.paid_at && !b.is_recurring) && (
                    <button
                      type="button"
                      onClick={() => handleMarkPaid(b.id)}
                      disabled={billBusyId === b.id}
                      className="min-h-[36px] px-2.5 rounded-md bg-success text-white text-xs font-bold disabled:opacity-60"
                    >
                      Lunas
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteBill(b.id)}
                    disabled={billBusyId === b.id}
                    className="min-h-[36px] px-2.5 rounded-md border border-neutral-border text-xs font-semibold text-neutral-500 disabled:opacity-60"
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
            className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-border"
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
              className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-neutral-border"
            />
            <input
              type="date"
              required
              value={billDueDate}
              onChange={(e) => setBillDueDate(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-neutral-border"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-neutral-500">
            <input type="checkbox" checked={billRecurring} onChange={(e) => setBillRecurring(e.target.checked)} />
            Tagihan berulang tiap bulan
          </label>
          <button
            type="submit"
            disabled={billSaving}
            className="min-h-[40px] bg-navy text-white rounded-lg text-sm font-bold disabled:opacity-60"
          >
            Tambah Tagihan
          </button>
          {billMsg && (
            <div className={`text-xs rounded-md px-3 py-2 ${billMsgType === "error" ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>
              {billMsg}
            </div>
          )}
        </form>
      </div>

      {/* Tanggal Uang Bulanan (student only) */}
      {isStudent && (
        <div className="bg-white border border-neutral-border rounded-xl p-3">
          <h2 className="text-sm font-semibold text-neutral-900 mb-1">Tanggal Uang Bulanan</h2>
          <p className="text-xs text-neutral-500 mb-2">
            Atur tanggal biasanya uang kiriman/bulanan cair, supaya dapat pengingat lembut di beranda.
          </p>
          <form onSubmit={handleSaveIncomeDay} className="flex flex-col gap-2">
            <label htmlFor="income-day" className="sr-only">
              Tanggal uang bulanan (1-31)
            </label>
            <input
              id="income-day"
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

      {/* Arisan & Iuran */}
      <div className="bg-white border border-neutral-border rounded-xl p-3">
        <h2 className="text-sm font-semibold text-neutral-900 mb-1">Arisan & Iuran</h2>
        <p className="text-xs text-neutral-500 mb-2">
          Catat setoran & giliran arisan, terpisah dari transaksi rumah tangga biasa.
        </p>

        {arisanGroups.length > 0 && (
          <div className="flex flex-col gap-2 mb-3">
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
            className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-border"
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
              className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-neutral-border"
            />
            <input
              type="text"
              value={arisanFrequency}
              onChange={(e) => setArisanFrequency(e.target.value)}
              placeholder="Bulanan"
              className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-neutral-border"
            />
          </div>
          <button
            type="submit"
            disabled={arisanSaving}
            className="min-h-[40px] bg-navy text-white rounded-lg text-sm font-bold disabled:opacity-60"
          >
            Buat Grup Arisan
          </button>
        </form>
      </div>

      {/* Kategori — bisa tambah/ubah/hapus, termasuk kategori bawaan sistem */}
      <div className="bg-white border border-neutral-border rounded-xl p-3">
        <h2 className="text-sm font-semibold text-neutral-900 mb-2">Kategori</h2>

        <div className="text-xs font-semibold text-neutral-500 mb-1">Pengeluaran</div>
        {categoriesExpense.map((c) => (
          <CategoryRow key={c.id} category={c} onRename={onRenameCategory} onDelete={onDeleteCategory} />
        ))}

        <div className="text-xs font-semibold text-neutral-500 mb-1 mt-3">Pemasukan</div>
        {categoriesIncome.map((c) => (
          <CategoryRow key={c.id} category={c} onRename={onRenameCategory} onDelete={onDeleteCategory} />
        ))}

        <form onSubmit={handleAddCategory} className="flex gap-2 mt-3">
          <label htmlFor="new-category-type" className="sr-only">Tipe kategori baru</label>
          <select
            id="new-category-type"
            value={newCategoryType}
            onChange={(e) => setNewCategoryType(e.target.value)}
            className="px-2 py-2 text-sm rounded-lg border border-neutral-border"
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
            className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-neutral-border"
          />
          <button
            type="submit"
            disabled={categorySaving}
            className="min-h-[40px] px-4 rounded-lg bg-navy text-white text-xs font-bold disabled:opacity-60"
          >
            Tambah
          </button>
        </form>
      </div>

      {/* Undang Anggota (owner only) */}
      {isOwner && (
        <div className="bg-white border border-neutral-border rounded-xl p-3">
          <h2 className="text-sm font-semibold text-neutral-900 mb-1">Undang Anggota Keluarga</h2>
          <form onSubmit={handleSendInvite} className="flex flex-col gap-2">
            <label htmlFor="invite-email" className="sr-only">
              Email anggota yang diundang
            </label>
            <input
              id="invite-email"
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
                className="min-h-[40px] bg-success text-white rounded-md px-3 text-xs font-bold whitespace-nowrap disabled:opacity-60"
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
