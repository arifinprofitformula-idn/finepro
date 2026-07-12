// src/pages/OnboardingPage.jsx
// Pilih persona household. Juga menampilkan undangan pending kalau ada —
// user baru yang diundang (mis. pasangan) bisa langsung gabung dari sini
// tanpa dipaksa bikin household sendiri dulu.

import { useEffect, useState } from "react";
import { getMyPendingInvites, acceptInvite } from "../api/invites.js";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, GraduationCap, HeartHandshake, Home, Sparkles, Users } from "lucide-react";

const PERSONAS = [
  {
    type: "family",
    icon: Users,
    tone: "mint",
    title: "Keluarga / Suami-Istri",
    short: "Untuk rumah yang dikelola bersama.",
    desc: "Kami siapkan kategori seperti rumah tangga, cicilan, pendidikan anak, dan kebutuhan bersama."
  },
  {
    type: "student",
    icon: GraduationCap,
    tone: "violet",
    title: "Mahasiswa",
    short: "Untuk hidup mandiri yang mulai ditata.",
    desc: "Mulai dari kos, uang makan, kuota, transportasi, sampai uang kiriman bulanan."
  },
  {
    type: "individual",
    icon: BriefcaseBusiness,
    tone: "gold",
    title: "Individu",
    short: "Untuk kamu yang ingin lebih sadar arus uang.",
    desc: "Kategori dibuat ringkas untuk pemasukan, kebutuhan pokok, tabungan, dan pengeluaran pribadi."
  }
];

const TONE = {
  mint: "bg-mint-light text-mint border-mint/20",
  violet: "bg-violet-light text-violet border-violet/20",
  gold: "bg-gold-light/70 text-gold border-gold/20"
};

export default function OnboardingPage({ onCreateHousehold, onInviteAccepted }) {
  const [loading, setLoading] = useState(false);
  const [invites, setInvites] = useState([]);
  const [acceptingId, setAcceptingId] = useState(null);
  const [selectedType, setSelectedType] = useState("");

  useEffect(() => {
    getMyPendingInvites().then(setInvites).catch(() => setInvites([]));
  }, []);

  async function handleContinue() {
    if (!selectedType) return;
    setLoading(true);
    try {
      await onCreateHousehold(selectedType);
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
    <div className="app-glow-bg min-h-screen px-5 py-7">
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-lg flex-col justify-center">
        <div className="grid gap-4">
          <div className="gloss-panel rounded-[30px] p-5 animate-auth-fade-up">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5 shadow-soft">
                  <img
                    src="/icon-192.png"
                    alt="FinePro"
                    className="h-full w-full rounded-xl object-cover"
                  />
                </div>
                <div>
                  <div className="text-sm font-bold leading-tight text-navy">FinePro</div>
                  <div className="text-[11px] font-medium text-neutral-500">Langkah pertama yang tenang</div>
                </div>
              </div>
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-violet-light text-violet">
                <Sparkles size={17} />
              </div>
            </div>

            <div className="mt-6">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-mint-light px-3 py-1 text-[11px] font-bold text-mint">
                <Home size={13} />
                Selamat datang
              </div>
              <h1 className="mt-3 text-2xl font-bold leading-tight text-navy">
                Yuk mulai dari cara kamu mengelola uang.
              </h1>
              <p className="mt-2 text-sm font-medium leading-relaxed text-neutral-500">
                Setiap orang punya ritme finansial yang berbeda. Pilih yang paling dekat dengan kehidupanmu,
                lalu kami bantu siapkan kategori awal yang terasa relevan.
              </p>
            </div>
          </div>

          {invites.length > 0 && (
            <div className="gloss-panel rounded-[26px] p-4 animate-auth-slide-up">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-mint-light text-mint">
                  <HeartHandshake size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-navy">Ada ruang keuangan yang menunggumu</h2>
                  <p className="text-xs font-medium text-neutral-500">Kamu bisa langsung bergabung tanpa membuat ruang baru.</p>
                </div>
              </div>
              <div className="grid gap-2">
                {invites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/55 p-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-navy">{inv.household_name}</div>
                      <div className="text-xs font-medium text-neutral-500">Diundang sebagai anggota</div>
                    </div>
                    <button
                      type="button"
                      disabled={acceptingId === inv.id}
                      onClick={() => handleAccept(inv.id)}
                      className="flex min-h-[38px] flex-shrink-0 items-center justify-center rounded-full bg-mint px-4 text-xs font-bold text-white disabled:opacity-60"
                    >
                      {acceptingId === inv.id ? "..." : "Gabung"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="gloss-panel rounded-[30px] p-4 animate-auth-slide-up">
            <div className="mb-3">
              <h2 className="text-base font-bold text-navy">Pilih ruang keuanganmu</h2>
              <p className="mt-1 text-xs font-medium leading-relaxed text-neutral-500">
                Ini hanya titik awal. Kategori tetap bisa kamu ubah kapan saja di halaman Akun.
              </p>
            </div>

            <div className="grid gap-2.5">
              {PERSONAS.map((p, index) => {
                const Icon = p.icon;
                const selected = selectedType === p.type;
                return (
                  <button
                    key={p.type}
                    type="button"
                    disabled={loading}
                    onClick={() => setSelectedType(p.type)}
                    className={`group flex min-h-[86px] items-start gap-3 rounded-2xl border p-3 text-left transition duration-300 hover:-translate-y-0.5 hover:bg-white/80 hover:shadow-soft disabled:opacity-60 ${
                      selected ? "border-violet bg-white shadow-soft" : "border-white/75 bg-white/60 hover:border-violet/30"
                    }`}
                    style={{ animationDelay: `${index * 70}ms` }}
                  >
                    <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border ${TONE[p.tone]}`}>
                      <Icon size={20} strokeWidth={2.4} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-bold text-navy">{p.title}</div>
                        {selected ? (
                          <CheckCircle2 size={17} className="flex-shrink-0 text-violet" />
                        ) : (
                          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-violet opacity-0 transition group-hover:opacity-100" />
                        )}
                      </div>
                      <div className="mt-0.5 text-xs font-semibold text-neutral-700">{p.short}</div>
                      <div className="mt-1 text-xs font-medium leading-relaxed text-neutral-500">{p.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl border border-neutral-border/70 bg-white/60 p-3">
              <p className="mb-3 text-xs font-medium leading-relaxed text-neutral-500">
                {selectedType
                  ? "Pilihan ini akan menyiapkan kategori awal yang paling relevan. Tenang, semuanya masih bisa diubah nanti."
                  : "Pilih salah satu ruang keuangan dulu, lalu lanjutkan saat sudah yakin."}
              </p>
              <button
                type="button"
                disabled={!selectedType || loading}
                onClick={handleContinue}
                className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-violet px-4 text-sm font-bold text-white shadow-[0_16px_32px_rgba(111,85,242,0.28)] transition active:scale-[0.98] disabled:bg-neutral-100 disabled:text-neutral-400 disabled:shadow-none"
              >
                {loading ? "Menyiapkan ruang keuanganmu..." : "Lanjutkan dengan pilihan ini"}
                {!loading && <ArrowRight size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
