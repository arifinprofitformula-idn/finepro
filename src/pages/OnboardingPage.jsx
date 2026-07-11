// src/pages/OnboardingPage.jsx
// Pilih persona household. Juga menampilkan undangan pending kalau ada —
// user baru yang diundang (mis. pasangan) bisa langsung gabung dari sini
// tanpa dipaksa bikin household sendiri dulu (fitur dari versi Alpine,
// dipertahankan di sini).

import { useEffect, useState } from "react";
import { getMyPendingInvites, acceptInvite } from "../api/invites.js";

const PERSONAS = [
  {
    type: "family",
    icon: "👨‍👩‍👧",
    title: "Keluarga / Suami-Istri",
    desc: "Kelola keuangan rumah tangga bersama pasangan, kategori seperti cicilan & pendidikan anak."
  },
  {
    type: "student",
    icon: "🎓",
    title: "Mahasiswa",
    desc: "Kategori seperti kos, uang kiriman ortu, kuota, dan uang jajan."
  },
  {
    type: "individual",
    icon: "🧑",
    title: "Individu",
    desc: "Kategori umum untuk pencatatan keuangan pribadi."
  }
];

export default function OnboardingPage({ onCreateHousehold, onInviteAccepted }) {
  const [loading, setLoading] = useState(false);
  const [invites, setInvites] = useState([]);
  const [acceptingId, setAcceptingId] = useState(null);

  useEffect(() => {
    getMyPendingInvites().then(setInvites).catch(() => setInvites([]));
  }, []);

  async function handlePick(type) {
    setLoading(true);
    try {
      await onCreateHousehold(type);
    } catch (err) {
      alert("Gagal membuat akun household: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(inviteId) {
    setAcceptingId(inviteId);
    try {
      await acceptInvite(inviteId);
      await onInviteAccepted();
    } catch (err) {
      alert("Gagal menerima undangan: " + err.message);
    } finally {
      setAcceptingId(null);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-bg px-6 py-8">
      <div className="w-full max-w-sm rounded-2xl bg-white border border-neutral-border p-6 shadow-sm">
        <div className="w-12 h-12 rounded-xl bg-navy text-white flex items-center justify-center font-bold text-lg mb-4">
          KK
        </div>
        <h1 className="text-lg font-bold text-neutral-900 mb-1">Selamat Datang!</h1>

        {invites.length > 0 && (
          <div className="bg-success/10 border border-success rounded-xl p-3 mb-4">
            <h3 className="text-sm font-semibold text-neutral-900 mb-2">
              Anda diundang bergabung ke household
            </h3>
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
                  onClick={() => handleAccept(inv.id)}
                  className="min-h-[36px] bg-success text-white rounded-md px-3 text-xs font-bold whitespace-nowrap disabled:opacity-60"
                >
                  Terima
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-sm text-neutral-500 mb-4">
          Atau, Anda mendaftar sebagai apa? Ini menentukan kategori keuangan yang paling relevan untuk Anda.
        </p>

        <div className="flex flex-col gap-2">
          {PERSONAS.map((p) => (
            <button
              key={p.type}
              type="button"
              disabled={loading}
              onClick={() => handlePick(p.type)}
              className="flex gap-3 items-start text-left min-h-[44px] border border-neutral-border rounded-xl p-3 hover:border-navy disabled:opacity-60 transition-colors"
            >
              <div className="text-xl leading-none mt-0.5" aria-hidden="true">{p.icon}</div>
              <div>
                <div className="text-sm font-bold text-neutral-900">{p.title}</div>
                <div className="text-xs text-neutral-500 leading-snug">{p.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
