import { useState } from "react";
import {
  getArisanGroupDetail,
  addArisanParticipant,
  removeArisanParticipant,
  toggleArisanPaid,
  deleteArisanGroup
} from "../api/arisan.js";
import { fmtRp, monthKey, todayStr } from "../utils/format.js";

export default function ArisanGroupCard({ group, onDeleted }) {
  const [expanded, setExpanded] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [period] = useState(monthKey(todayStr()));
  const [newName, setNewName] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next) {
      setLoading(true);
      try {
        const data = await getArisanGroupDetail(group.id, period);
        setParticipants(data.participants);
      } catch {
        setParticipants([]);
      } finally {
        setLoading(false);
      }
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
      await deleteArisanGroup(group.id);
      onDeleted(group.id);
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
