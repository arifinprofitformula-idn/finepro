import { useState } from "react";
import {
  getArisanGroupDetail,
  addArisanParticipant,
  removeArisanParticipant,
  toggleArisanPaid,
  getArisanEntries,
  addArisanEntry,
  deleteArisanEntry
} from "../api/arisan.js";
import { fmtRp, monthKey, todayStr } from "../utils/format.js";

export default function ArisanGroupCard({ group, onDeleted }) {
  const [expanded, setExpanded] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [period] = useState(monthKey(todayStr()));
  const [newName, setNewName] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [loading, setLoading] = useState(false);

  const [entries, setEntries] = useState([]);
  const [entryName, setEntryName] = useState("");
  const [entryAmount, setEntryAmount] = useState("");
  const [entryDate, setEntryDate] = useState(todayStr());
  const [entryIsPayout, setEntryIsPayout] = useState(false);
  const [entrySaving, setEntrySaving] = useState(false);
  const [entryBusyId, setEntryBusyId] = useState(null);

  async function handleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next) {
      setLoading(true);
      try {
        const [detail, entryList] = await Promise.all([
          getArisanGroupDetail(group.id, period),
          getArisanEntries(group.id)
        ]);
        setParticipants(detail.participants);
        setEntries(entryList);
      } catch {
        setParticipants([]);
        setEntries([]);
      } finally {
        setLoading(false);
      }
    }
  }

  async function handleAddEntry(e) {
    e.preventDefault();
    const amt = parseFloat(entryAmount);
    if (!entryName.trim() || !Number.isFinite(amt) || amt < 0) return;
    setEntrySaving(true);
    try {
      const entry = await addArisanEntry(group.id, {
        date: entryDate,
        member_name: entryName.trim(),
        amount: amt,
        is_payout: entryIsPayout
      });
      setEntries((prev) => [entry, ...prev]);
      setEntryName("");
      setEntryAmount("");
      setEntryIsPayout(false);
    } catch (err) {
      alert("Gagal mencatat setoran: " + err.message);
    } finally {
      setEntrySaving(false);
    }
  }

  async function handleDeleteEntry(id) {
    setEntryBusyId(id);
    try {
      await deleteArisanEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      alert("Gagal menghapus catatan: " + err.message);
    } finally {
      setEntryBusyId(null);
    }
  }

  async function handleAddParticipant(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const p = await addArisanParticipant(group.id, newName.trim());
      setParticipants((prev) => [...prev, { ...p, paid: false }]);
      setNewName("");
    } catch (err) {
      alert("Gagal menambah peserta: " + err.message);
    }
  }

  async function handleRemoveParticipant(id) {
    setBusyId(id);
    try {
      await removeArisanParticipant(id);
      setParticipants((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      alert("Gagal menghapus peserta: " + err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleTogglePaid(id) {
    setBusyId(id);
    try {
      const paid = await toggleArisanPaid(id, period);
      setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, paid } : p)));
    } catch (err) {
      alert("Gagal mengubah status: " + err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteGroup() {
    if (!confirm(`Hapus grup arisan "${group.name}"? Semua peserta & data bayar ikut terhapus.`)) return;
    try {
      await onDeleted(group.id);
    } catch (err) {
      alert("Gagal menghapus grup: " + err.message);
    }
  }

  return (
    <div className="border border-neutral-border rounded-lg p-3">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={handleExpand} className="min-w-0 flex-1 text-left">
          <div className="text-sm font-semibold text-neutral-900 truncate">{group.name}</div>
          <div className="text-xs text-neutral-500">
            {fmtRp(group.amount_per_period)} · {group.frequency_label} · {group.participant_count} peserta
          </div>
        </button>
        <button
          type="button"
          onClick={handleDeleteGroup}
          className="min-h-[36px] px-2.5 rounded-md border border-neutral-border text-xs font-semibold text-neutral-500 flex-shrink-0"
        >
          Hapus
        </button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-neutral-border">
          <div className="text-xs font-semibold text-neutral-500 mb-2">Periode {period}</div>
          {loading ? (
            <div className="text-xs text-neutral-500">Memuat...</div>
          ) : (
            <>
              {participants.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="text-sm text-neutral-900 truncate">{p.participant_name}</span>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleTogglePaid(p.id)}
                      disabled={busyId === p.id}
                      className={`min-h-[32px] px-2.5 rounded-md text-xs font-bold disabled:opacity-60 ${
                        p.paid ? "bg-success text-white" : "border border-neutral-border text-neutral-500"
                      }`}
                    >
                      {p.paid ? "Lunas" : "Belum"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveParticipant(p.id)}
                      disabled={busyId === p.id}
                      className="min-h-[32px] px-2 rounded-md text-xs text-neutral-500 disabled:opacity-60"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              {participants.length === 0 && (
                <div className="text-xs text-neutral-500 py-1">Belum ada peserta.</div>
              )}
              <form onSubmit={handleAddParticipant} className="flex gap-2 mt-2">
                <label htmlFor={`arisan-participant-${group.id}`} className="sr-only">Nama peserta baru</label>
                <input
                  id={`arisan-participant-${group.id}`}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nama peserta baru"
                  className="flex-1 min-w-0 px-3 py-1.5 text-sm rounded-lg border border-neutral-border"
                />
                <button type="submit" className="min-h-[36px] px-3 rounded-lg bg-navy text-white text-xs font-bold">
                  Tambah
                </button>
              </form>

              <div className="mt-4 pt-3 border-t border-neutral-border">
                <div className="text-xs font-semibold text-neutral-500 mb-2">Riwayat Setoran & Giliran Menerima</div>
                {entries.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-2 py-1.5">
                    <div className="min-w-0">
                      <div className="text-sm text-neutral-900 truncate">
                        {e.member_name}
                        {e.is_payout && (
                          <span className="ml-1.5 rounded-full bg-gold-light px-2 py-0.5 text-[10px] font-bold text-gold">
                            Giliran Menerima
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-500">{e.date} · {fmtRp(e.amount)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteEntry(e.id)}
                      disabled={entryBusyId === e.id}
                      className="min-h-[32px] px-2 rounded-md text-xs text-neutral-500 disabled:opacity-60 flex-shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {entries.length === 0 && (
                  <div className="text-xs text-neutral-500 py-1">Belum ada setoran tercatat.</div>
                )}

                <form onSubmit={handleAddEntry} className="mt-2 flex flex-col gap-2">
                  <div className="flex gap-2">
                    <label htmlFor={`arisan-entry-name-${group.id}`} className="sr-only">Nama anggota</label>
                    <input
                      id={`arisan-entry-name-${group.id}`}
                      type="text"
                      value={entryName}
                      onChange={(ev) => setEntryName(ev.target.value)}
                      placeholder="Nama anggota"
                      className="flex-1 min-w-0 px-3 py-1.5 text-sm rounded-lg border border-neutral-border"
                    />
                    <label htmlFor={`arisan-entry-date-${group.id}`} className="sr-only">Tanggal</label>
                    <input
                      id={`arisan-entry-date-${group.id}`}
                      type="date"
                      value={entryDate}
                      onChange={(ev) => setEntryDate(ev.target.value)}
                      className="px-2 py-1.5 text-sm rounded-lg border border-neutral-border"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor={`arisan-entry-amount-${group.id}`} className="sr-only">Nominal</label>
                    <input
                      id={`arisan-entry-amount-${group.id}`}
                      type="number"
                      min="0"
                      value={entryAmount}
                      onChange={(ev) => setEntryAmount(ev.target.value)}
                      placeholder="Nominal (Rp)"
                      className="flex-1 min-w-0 px-3 py-1.5 text-sm rounded-lg border border-neutral-border"
                    />
                    <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={entryIsPayout}
                        onChange={(ev) => setEntryIsPayout(ev.target.checked)}
                        className="h-3.5 w-3.5 accent-gold"
                      />
                      Giliran menerima
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={entrySaving}
                    className="min-h-[36px] px-3 rounded-lg bg-navy text-white text-xs font-bold disabled:opacity-60"
                  >
                    Catat Setoran
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
