// src/pages/SettingPage.jsx
import { useState, useEffect } from "react";
import { updateMonthlyIncomeDay } from "../api/households.js";
import { exportMonthCSV, exportMonthPDF } from "../api/transactions.js";
import ArisanGroupCard from "../components/ArisanGroupCard.jsx";
import WalletCard from "../components/WalletCard.jsx";
import CategoryRow from "../components/CategoryRow.jsx";
import { useWallets } from "../hooks/useWallets.js";
import { useArisan } from "../hooks/useArisan.js";
import { changePassword, translateAuthError } from "../api/auth.js";
import { disconnectTelegramLink, startTelegramLink } from "../api/telegram.js";
import { disconnectWhatsAppLink, startWhatsAppLink } from "../api/whatsapp.js";
import { subscribeToPush, getPushPermissionState } from "../api/push.js";
import { monthKey, todayStr } from "../utils/format.js";
import { hasNativeInstallPrompt, isAppInstalled, runNativeInstallPrompt, subscribeInstallState } from "../utils/pwaInstall.js";
import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Bell,
  CalendarClock,
  Copy,
  Download,
  ExternalLink,
  Home,
  KeyRound,
  LogOut,
  MessageCircle,
  Smartphone,
  Tag,
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

function openTelegramLink(url) {
  if (!url) return;
  window.location.assign(url);
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

export default function SettingPage({
  user,
  household,
  categoriesExpense,
  categoriesIncome,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
  onUserUpdated,
  onHouseholdUpdated,
  onLogout
}) {
  const [installCardVisible, setInstallCardVisible] = useState(() => !isAppInstalled());
  const [installManualHelp, setInstallManualHelp] = useState(false);
  const [pushPermission, setPushPermission] = useState("default");
  const [pushSubscribing, setPushSubscribing] = useState(false);
  const [pushMsg, setPushMsg] = useState("");
  const [monthlyIncomeDayInput, setMonthlyIncomeDayInput] = useState(household.monthly_income_day || "");
  const [incomeDaySaving, setIncomeDaySaving] = useState(false);
  const [incomeDayMsg, setIncomeDayMsg] = useState("");
  const [incomeDayMsgType, setIncomeDayMsgType] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
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
  const { groups: arisanGroups, addGroup: addArisanGroupToHook, removeGroup: removeArisanGroup } = useArisan(household.id);
  const [arisanName, setArisanName] = useState("");
  const [arisanAmount, setArisanAmount] = useState("");
  const [arisanFrequency, setArisanFrequency] = useState("Bulanan");
  const [arisanSaving, setArisanSaving] = useState(false);
  const [categoryTab, setCategoryTab] = useState("expense");
  const [newCategoryType, setNewCategoryType] = useState("expense");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordMsgType, setPasswordMsgType] = useState("");
  const [telegramLinkLoading, setTelegramLinkLoading] = useState(false);
  const [telegramLink, setTelegramLink] = useState(null);
  const [telegramLinkMsg, setTelegramLinkMsg] = useState("");
  const [telegramLinkMsgType, setTelegramLinkMsgType] = useState("");
  const [telegramDisconnecting, setTelegramDisconnecting] = useState(false);

  const [whatsappLinkLoading, setWhatsappLinkLoading] = useState(false);
  const [whatsappLink, setWhatsappLink] = useState(null);
  const [whatsappLinkMsg, setWhatsappLinkMsg] = useState("");
  const [whatsappLinkMsgType, setWhatsappLinkMsgType] = useState("");
  const [whatsappDisconnecting, setWhatsappDisconnecting] = useState(false);

  const isStudent = household.household_type === "student";

  useEffect(() => {
    const refreshInstallState = () => setInstallCardVisible(!isAppInstalled());
    refreshInstallState();
    return subscribeInstallState(refreshInstallState);
  }, []);

  useEffect(() => {
    getPushPermissionState().then(setPushPermission);
  }, []);

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

  useEffect(() => {
    if (wallets.length >= 2) {
      setTransferFrom((prev) => prev || wallets[0].id);
      setTransferTo((prev) => prev || wallets[1].id);
    }
  }, [wallets]);

  async function handleInstallApp() {
    const result = await runNativeInstallPrompt();
    if (!result.supported) {
      setInstallManualHelp(true);
    }
    setInstallCardVisible(!isAppInstalled());
  }

  async function handleStartTelegramLink() {
    setTelegramLinkLoading(true);
    setTelegramLinkMsg("");
    setTelegramLinkMsgType("");
    try {
      const data = await startTelegramLink();
      setTelegramLink(data);
      if (data.deep_link) {
        setTelegramLinkMsg("Telegram dibuka. Jika belum berpindah otomatis, gunakan tombol Buka Telegram di bawah.");
        setTelegramLinkMsgType("success");
        openTelegramLink(data.deep_link);
      } else {
        setTelegramLinkMsg("Username bot Telegram belum dikonfigurasi. Gunakan kode manual atau hubungi admin.");
        setTelegramLinkMsgType("error");
      }
    } catch (err) {
      setTelegramLinkMsg(err.message);
      setTelegramLinkMsgType("error");
    } finally {
      setTelegramLinkLoading(false);
    }
  }

  async function handleCopyTelegramCode() {
    if (!telegramLink?.code) return;
    const text = `/start ${telegramLink.code}`;
    try {
      await navigator.clipboard.writeText(text);
      setTelegramLinkMsg("Kode Telegram berhasil disalin.");
      setTelegramLinkMsgType("success");
    } catch {
      setTelegramLinkMsg(`Salin manual: ${text}`);
      setTelegramLinkMsgType("error");
    }
  }

  async function handleDisconnectTelegram() {
    if (!confirm("Putuskan koneksi Telegram? Bot tidak akan bisa mencatat transaksi otomatis dari akun Telegram ini lagi.")) {
      return;
    }
    setTelegramDisconnecting(true);
    setTelegramLinkMsg("");
    setTelegramLinkMsgType("");
    try {
      const data = await disconnectTelegramLink();
      onUserUpdated(data.user);
      setTelegramLink(null);
      setTelegramLinkMsg(data.message || "Akun Telegram berhasil diputuskan.");
      setTelegramLinkMsgType("success");
    } catch (err) {
      setTelegramLinkMsg(err.message);
      setTelegramLinkMsgType("error");
    } finally {
      setTelegramDisconnecting(false);
    }
  }

  function openWhatsAppLink(phone, text) {
    if (!phone) return;
    const url = text
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/${phone}`;
    window.open(url, "_blank", "noopener");
  }

  async function handleStartWhatsAppLink() {
    setWhatsappLinkLoading(true);
    setWhatsappLinkMsg("");
    setWhatsappLinkMsgType("");
    try {
      const data = await startWhatsAppLink();
      setWhatsappLink(data);
      if (data.wa_phone && data.wa_phone !== "belum dikonfigurasi") {
        // Langsung buka WhatsApp dengan kode pre-filled
        openWhatsAppLink(data.wa_phone, data.code);
        setWhatsappLinkMsg("WhatsApp dibuka. Jika belum berpindah otomatis, gunakan tombol Buka WhatsApp di bawah.");
        setWhatsappLinkMsgType("success");
      } else {
        setWhatsappLinkMsg("Nomor WhatsApp bisnis belum dikonfigurasi. Gunakan kode manual atau hubungi admin.");
        setWhatsappLinkMsgType("error");
      }
    } catch (err) {
      setWhatsappLinkMsg(err.message);
      setWhatsappLinkMsgType("error");
    } finally {
      setWhatsappLinkLoading(false);
    }
  }

  async function handleCopyWhatsAppCode() {
    if (!whatsappLink?.code) return;
    try {
      await navigator.clipboard.writeText(whatsappLink.code);
      setWhatsappLinkMsg("Kode WhatsApp berhasil disalin.");
      setWhatsappLinkMsgType("success");
    } catch {
      setWhatsappLinkMsg(`Salin manual: ${whatsappLink.code}`);
      setWhatsappLinkMsgType("error");
    }
  }

  async function handleDisconnectWhatsApp() {
    if (!confirm("Putuskan koneksi WhatsApp? Bot tidak akan bisa mencatat transaksi otomatis dari WhatsApp ini lagi.")) {
      return;
    }
    setWhatsappDisconnecting(true);
    setWhatsappLinkMsg("");
    setWhatsappLinkMsgType("");
    try {
      const data = await disconnectWhatsAppLink();
      onUserUpdated(data.user);
      setWhatsappLink(null);
      setWhatsappLinkMsg(data.message || "Akun WhatsApp berhasil diputuskan.");
      setWhatsappLinkMsgType("success");
    } catch (err) {
      setWhatsappLinkMsg(err.message);
      setWhatsappLinkMsgType("error");
    } finally {
      setWhatsappDisconnecting(false);
    }
  }

  async function handleAddArisanGroup(e) {
    e.preventDefault();
    setArisanSaving(true);
    try {
      await addArisanGroupToHook({
        name: arisanName,
        amount_per_period: parseFloat(arisanAmount) || 0,
        frequency_label: arisanFrequency
      });
      setArisanName("");
      setArisanAmount("");
    } catch (err) {
      alert("Gagal membuat grup arisan: " + err.message);
    } finally {
      setArisanSaving(false);
    }
  }

  async function handleArisanGroupDeleted(groupId) {
    await removeArisanGroup(groupId);
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

  async function handleChangePassword(e) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMsg("Konfirmasi password baru tidak cocok.");
      setPasswordMsgType("error");
      return;
    }
    setPasswordSaving(true);
    setPasswordMsg("");
    try {
      const data = await changePassword(user.has_password ? oldPassword : undefined, newPassword);
      onUserUpdated({ has_password: true });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMsg(data.message);
      setPasswordMsgType("success");
    } catch (err) {
      setPasswordMsg(translateAuthError(err.message));
      setPasswordMsgType("error");
    } finally {
      setPasswordSaving(false);
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
      {installCardVisible && (
        <div className="gloss-panel mb-4 rounded-2xl p-4">
          <SectionHeader icon={Smartphone} tone="violet" title="Install Aplikasi" />
          <p className="text-xs font-medium leading-relaxed text-neutral-500">
            Tambahkan Finepro ke layar utama agar akses lebih cepat tanpa perlu membuka browser manual.
          </p>
          {installManualHelp && (
            <div className="mt-3 rounded-xl border border-neutral-border/70 bg-white/60 px-3 py-2 text-xs font-semibold leading-relaxed text-neutral-600">
              <div className="mb-1 flex items-center gap-1.5 text-violet">
                <Home size={14} />
                Cara manual
              </div>
              Android: buka menu browser lalu pilih <span className="text-navy">Tambahkan ke layar utama</span>.
              iPhone: tekan Share lalu <span className="text-navy">Add to Home Screen</span>.
            </div>
          )}
          <button type="button" onClick={handleInstallApp} className={`${primaryBtnClass} mt-3 w-full`}>
            <Download size={15} />
            {hasNativeInstallPrompt() ? "Install Sekarang" : "Lihat Cara Install"}
          </button>
        </div>
      )}

      {/* Notifikasi */}
      <div className="gloss-panel mb-4 rounded-2xl p-4">
        <SectionHeader icon={Bell} tone="coral" title="Notifikasi" />
        {pushPermission !== "granted" && pushPermission !== "unsupported" && (
          <button type="button" onClick={handleEnablePush} disabled={pushSubscribing} className={`${primaryBtnClass} w-full`}>
            <Bell size={15} />
            {pushSubscribing ? "Mengaktifkan..." : "Aktifkan Notifikasi Budget"}
          </button>
        )}
        {pushPermission === "granted" && <p className="text-xs font-medium text-mint">✓ Notifikasi budget aktif</p>}
        {pushPermission === "unsupported" && <p className="text-xs text-neutral-500">Perangkat/browser ini tidak mendukung notifikasi push.</p>}
        {pushMsg && <p className="mt-1 text-xs text-neutral-500">{pushMsg}</p>}
      </div>

      {/* Telegram — hubungkan akun supaya foto struk/bukti transfer yang
          dikirim ke bot otomatis jadi transaksi lewat n8n */}
      <div className="gloss-panel mb-4 rounded-2xl p-4">
        <SectionHeader icon={MessageCircle} tone="mint" title="Hubungkan Telegram" />
        {user.telegram_id ? (
          <>
            <p className="text-xs font-medium text-mint">
              ✓ Terhubung {user.telegram_username ? `sebagai @${user.telegram_username}` : ""}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Foto struk atau bukti transfer yang dikirim ke bot akan dicatat otomatis ke akun ini.
            </p>
            <button
              type="button"
              onClick={handleDisconnectTelegram}
              disabled={telegramDisconnecting}
              className={`${outlineBtnClass} mt-3 w-full border-coral text-coral disabled:opacity-60`}
            >
              <MessageCircle size={15} />
              {telegramDisconnecting ? "Memutuskan..." : "Putuskan Telegram"}
            </button>
            <StatusMsg msg={telegramLinkMsg} type={telegramLinkMsgType} />
          </>
        ) : (
          <>
            <p className="text-xs text-neutral-500">
              Tekan tombol di bawah. Telegram akan terbuka otomatis dengan kode hubung yang sudah disiapkan.
            </p>
            {!telegramLink ? (
              <button
                type="button"
                onClick={handleStartTelegramLink}
                disabled={telegramLinkLoading}
                className={`${primaryBtnClass} mt-3 w-full`}
              >
                <MessageCircle size={15} />
                {telegramLinkLoading ? "Membuka Telegram..." : "Hubungkan Telegram"}
              </button>
            ) : (
              <div className="mt-3 rounded-2xl border border-mint/25 bg-mint-light px-3 py-3 text-xs text-navy">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-mint">Kode siap dikirim</p>
                    <p className="mt-1 font-mono text-base font-bold tracking-widest text-navy">{telegramLink.code}</p>
                  </div>
                  {telegramLink.deep_link && (
                    <button
                      type="button"
                      onClick={() => openTelegramLink(telegramLink.deep_link)}
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-violet text-white"
                      title="Buka Telegram"
                    >
                      <ExternalLink size={16} />
                    </button>
                  )}
                </div>
                <p className="mt-2 leading-relaxed text-neutral-600">
                  Jika Telegram tidak terbuka otomatis, buka bot
                  {telegramLink.bot_username ? <span className="font-semibold text-navy"> @{telegramLink.bot_username}</span> : " Telegram Finepro"}
                  lalu kirim <span className="font-mono font-semibold">/start {telegramLink.code}</span>. Kode berlaku 10 menit.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {telegramLink.deep_link && (
                    <button
                      type="button"
                      onClick={() => openTelegramLink(telegramLink.deep_link)}
                      className={`${primaryBtnClass} w-full`}
                    >
                      <MessageCircle size={15} />
                      Buka Telegram
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCopyTelegramCode}
                    className={`${outlineBtnClass} w-full`}
                  >
                    <Copy size={15} />
                    Salin Kode
                  </button>
                </div>
              </div>
            )}
            <StatusMsg msg={telegramLinkMsg} type={telegramLinkMsgType} />
          </>
        )}
      </div>

      {/* WhatsApp — hubungkan akun supaya foto struk/bukti transfer yang
          dikirim ke WhatsApp bot otomatis jadi transaksi */}
      <div className="gloss-panel mb-4 rounded-2xl p-4">
        <SectionHeader icon={Smartphone} tone="mint" title="Hubungkan WhatsApp" />
        {user.whatsapp_id ? (
          <>
            <p className="text-xs font-medium text-mint">
              ✓ Terhubung sebagai {user.whatsapp_id.replace(/^62/, '0').replace(/(\d{4})(\d{4})(\d+)/, '$1-$2-$3')}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Foto struk yang dikirim via WhatsApp akan otomatis tercatat sebagai transaksi di akun ini.
            </p>
            <button
              type="button"
              onClick={handleDisconnectWhatsApp}
              disabled={whatsappDisconnecting}
              className={`${outlineBtnClass} mt-3 w-full border-coral text-coral disabled:opacity-60`}
            >
              <Smartphone size={15} />
              {whatsappDisconnecting ? "Memutuskan..." : "Putuskan WhatsApp"}
            </button>
            <StatusMsg msg={whatsappLinkMsg} type={whatsappLinkMsgType} />
          </>
        ) : (
          <>
            <p className="text-xs text-neutral-500">
              Hubungkan WhatsApp untuk mencatat transaksi otomatis dari foto struk yang kamu kirim ke bot WhatsApp bisnis.
            </p>
            {!whatsappLink ? (
              <button
                type="button"
                onClick={handleStartWhatsAppLink}
                disabled={whatsappLinkLoading}
                className={`${primaryBtnClass} mt-3 w-full`}
              >
                <Smartphone size={15} />
                {whatsappLinkLoading ? "Membuat kode..." : "Hubungkan WhatsApp"}
              </button>
            ) : (
              <div className="mt-3 rounded-xl border border-mint/30 bg-mint-light/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-mint">Kode siap dikirim</p>
                    <p className="mt-1 font-mono text-base font-bold tracking-widest text-navy">{whatsappLink.code}</p>
                  </div>
                  {whatsappLink.wa_phone && whatsappLink.wa_phone !== "belum dikonfigurasi" && (
                    <button
                      type="button"
                      onClick={() => openWhatsAppLink(whatsappLink.wa_phone, whatsappLink.code)}
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-mint text-white"
                      title="Buka WhatsApp"
                    >
                      <ExternalLink size={16} />
                    </button>
                  )}
                </div>
                <p className="mt-2 leading-relaxed text-neutral-600">
                  {whatsappLink.wa_phone && whatsappLink.wa_phone !== "belum dikonfigurasi" ? (
                    <>
                      Kirim kode di atas ke nomor WhatsApp{" "}
                      <span className="font-semibold text-navy">{whatsappLink.wa_phone}</span>.
                    </>
                  ) : (
                    "Kirim kode di atas ke nomor WhatsApp bisnis."
                  )}{" "}
                  Kode berlaku 10 menit.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {whatsappLink.wa_phone && whatsappLink.wa_phone !== "belum dikonfigurasi" && (
                    <button
                      type="button"
                      onClick={() => openWhatsAppLink(whatsappLink.wa_phone, whatsappLink.code)}
                      className={`${primaryBtnClass} w-full`}
                    >
                      <Smartphone size={15} />
                      Buka WhatsApp
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCopyWhatsAppCode}
                    className={`${outlineBtnClass} w-full`}
                  >
                    <Copy size={15} />
                    Salin Kode
                  </button>
                </div>
              </div>
            )}
            <StatusMsg msg={whatsappLinkMsg} type={whatsappLinkMsgType} />
          </>
        )}
      </div>

      {/* Keamanan — ganti password (atau buat password baru untuk akun Google-only) */}
      <div className="gloss-panel mb-4 rounded-2xl p-4">
        <SectionHeader icon={KeyRound} tone="coral" title={user.has_password ? "Ganti Password" : "Buat Password"} />
        {!user.has_password && (
          <p className="mb-2 text-xs text-neutral-500">
            Anda masuk dengan Google. Buat password supaya bisa masuk manual juga.
          </p>
        )}
        <form onSubmit={handleChangePassword} className="flex flex-col gap-2">
          {user.has_password && (
            <input
              type="password"
              required
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Password lama"
              className={inputClass}
            />
          )}
          <input
            type="password"
            required
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Password baru (minimal 6 karakter)"
            className={inputClass}
          />
          <input
            type="password"
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Konfirmasi password baru"
            className={inputClass}
          />
          <button type="submit" disabled={passwordSaving} className={primaryBtnClass}>
            {passwordSaving ? "Menyimpan..." : user.has_password ? "Simpan Password Baru" : "Buat Password"}
          </button>
          <StatusMsg msg={passwordMsg} type={passwordMsgType} />
        </form>
      </div>

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

      {/* Keluar */}
      <button type="button" onClick={onLogout} className={`${outlineBtnClass} mb-4 w-full`}>
        <LogOut size={15} />
        Keluar
      </button>
    </div>
  );
}
