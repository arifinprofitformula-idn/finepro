import { useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";

export default function CategoryRow({ category, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim() || name.trim() === category.name) {
      setEditing(false);
      setName(category.name);
      return;
    }
    setSaving(true);
    try {
      await onRename(category.id, name.trim());
      setEditing(false);
    } catch (err) {
      alert("Gagal mengubah kategori: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Hapus kategori "${category.name}"? Transaksi lama tetap tersimpan dengan nama ini.`)) return;
    try {
      await onDelete(category.id);
    } catch (err) {
      alert("Gagal menghapus kategori: " + err.message);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 border-b border-neutral-border py-2 last:border-0">
        <label htmlFor={`cat-${category.id}`} className="sr-only">Nama kategori</label>
        <input
          id={`cat-${category.id}`}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className="flex-1 min-w-0 px-2 py-1 text-sm rounded-lg border border-neutral-border"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex h-8 w-8 items-center justify-center rounded-full text-mint disabled:opacity-60"
          aria-label="Simpan"
        >
          <Check size={16} />
        </button>
        <button
          type="button"
          onClick={() => { setEditing(false); setName(category.name); }}
          className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400"
          aria-label="Batal"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between border-b border-neutral-border py-2 last:border-0">
      <div className="text-sm font-medium text-neutral-900">{category.name}</div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500"
          aria-label={`Ubah ${category.name}`}
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="flex h-8 w-8 items-center justify-center rounded-full text-coral"
          aria-label={`Hapus ${category.name}`}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
