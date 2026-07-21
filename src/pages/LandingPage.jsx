// src/pages/LandingPage.jsx
// Landing page publik Fine Pro — ditampilkan di "/" untuk pengunjung yang
// belum login (lihat src/App.jsx). React biasa (bukan Alpine.js) supaya
// konsisten dengan sisa aplikasi dan tidak menambah dependency baru.

import { useEffect, useState } from "react";
import { useTracking, openPrivacySettings } from "../components/tracking/TrackingProvider.jsx";
import {
  ArrowRight,
  BarChart3,
  Bell,
  BrainCircuit,
  CalendarClock,
  Camera,
  Check,
  ChevronDown,
  Download,
  FileText,
  Gift,
  HandCoins,
  HandHeart,
  HeartPulse,
  Home as HomeIcon,
  Layers,
  LineChart,
  LogIn,
  Menu,
  MessageCircle,
  Moon,
  Music2,
  PiggyBank,
  Receipt,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Sun,
  Target,
  Users,
  X
} from "lucide-react";

const NAV_LINKS = [
  { href: "#masalah", label: "Masalah" },
  { href: "#fitur", label: "Fitur" },
  { href: "#cara-kerja", label: "Cara Kerja" },
  { href: "#preview", label: "Preview" },
  { href: "#faq", label: "FAQ" }
];

const PAIN_POINTS = [
  {
    icon: HomeIcon,
    tone: "coral",
    title: "Gaji masuk, tapi cepat hilang",
    desc: "Baru awal bulan rasanya lega, tapi belum juga pertengahan bulan saldo sudah menipis tanpa tahu sebabnya."
  },
  {
    icon: ShoppingBag,
    tone: "gold",
    title: "Pengeluaran kecil tidak terasa",
    desc: "Jajan, ongkos, langganan kecil-kecilan — satu-satu kelihatan remeh, tapi kalau dikumpulkan bisa bikin kaget di akhir bulan."
  },
  {
    icon: Target,
    tone: "violet",
    title: "Budget bulanan sering gagal",
    desc: "Sudah niat bikin batasan pengeluaran, tapi tidak ada yang mengingatkan waktu batasnya mulai terlewati."
  },
  {
    icon: BarChart3,
    tone: "mint",
    title: "Tidak tahu kategori paling boros",
    desc: "Kebutuhan, keinginan, tabungan, sampai sedekah — semua campur aduk, jadi susah tahu pos mana yang paling banyak makan uang."
  },
  {
    icon: RefreshCw,
    tone: "coral",
    title: "Sulit konsisten mencatat",
    desc: "Sudah coba beberapa aplikasi atau buku catatan, tapi berhenti di minggu kedua karena ribet atau lupa."
  },
  {
    icon: PiggyBank,
    tone: "gold",
    title: "Tabungan & sedekah kalah prioritas",
    desc: "Niatnya nabung dan sedekah dulu, kenyataannya selalu jadi sisa terakhir — kalau ada sisa."
  }
];

const SOLUTION_POINTS = [
  "Catat pemasukan dan pengeluaran dalam hitungan detik",
  "Pantau saldo real-time, tidak perlu hitung manual",
  "Atur budget per kategori sesuai kebutuhan hidupmu",
  "Lihat realisasi pengeluaran dibanding rencana",
  "Cek transaksi terbaru kapan saja dari HP",
  "Pakai mode terang atau gelap sesuai kenyamanan mata"
];

const FEATURES = [
  {
    icon: Layers,
    tone: "violet",
    title: "Dashboard Ringkas",
    desc: "Semua kondisi keuangan — pemasukan, pengeluaran, saldo — kelihatan sekali lihat, tanpa perlu buka banyak halaman."
  },
  {
    icon: Target,
    tone: "mint",
    title: "Budget vs Realisasi",
    desc: "Tentukan batas tiap kategori, lalu pantau seberapa dekat kamu dengan batas itu setiap bulan berjalan."
  },
  {
    icon: Receipt,
    tone: "gold",
    title: "Kategori Keuangan Personal",
    desc: "Rumah tangga, kesehatan, hiburan, tabungan, sampai sedekah — dipisah rapi sesuai cara orang Indonesia mengatur uang."
  },
  {
    icon: CalendarClock,
    tone: "coral",
    title: "Transaksi Terbaru",
    desc: "Riwayat catatan tersusun rapi berdasarkan waktu, gampang ditelusuri kalau butuh cek pengeluaran tertentu."
  },
  {
    icon: Smartphone,
    tone: "violet",
    title: "Mobile First",
    desc: "Didesain dari awal untuk dipakai satu tangan di HP — bukan aplikasi desktop yang dipaksa muat di layar kecil."
  },
  {
    icon: Moon,
    tone: "mint",
    title: "Dark & Light Mode",
    desc: "Catat kapan saja, siang atau malam, dengan tampilan yang tetap nyaman di mata."
  },
  {
    icon: LineChart,
    tone: "mint",
    title: "Grafik Arus Kas Lengkap",
    desc: "Analisis harian, bulanan, dan per kategori dalam satu tampilan grafik — gampang lihat tren pemasukan dan pengeluaran dari waktu ke waktu."
  },
  {
    icon: Bell,
    tone: "coral",
    title: "Reminder Budget Otomatis",
    desc: "Notifikasi otomatis masuk ke HP saat pengeluaran kategori tertentu mulai mendekati atau melewati batas budget bulan ini."
  },
  {
    icon: PiggyBank,
    tone: "gold",
    title: "Target Tabungan, Emas & Perak",
    desc: "Tetapkan target menabung dalam Rupiah, emas, atau perak — lengkap harga pasar real-time dan estimasi nilai asetmu."
  },
  {
    icon: BrainCircuit,
    tone: "violet",
    title: "Analisa Keuangan AI",
    desc: "Minta analisa keuangan berbasis AI kapan saja, lengkap rekomendasi personal dan koneksi langsung ke target tabunganmu."
  },
  {
    icon: Download,
    tone: "mint",
    title: "Export & Backup Data",
    desc: "Unduh transaksi ke CSV atau PDF rapi, atau backup penuh datamu kapan saja untuk arsip pribadi."
  }
];

const SMART_FEATURES = [
  {
    icon: Camera,
    tone: "violet",
    title: "Scan Struk Otomatis",
    desc: "Foto struk belanja atau bukti transfer, AI langsung baca nominal dan kategori lalu isi form transaksi — tinggal cek dan simpan."
  },
  {
    icon: MessageCircle,
    tone: "mint",
    title: "Integrasi Telegram",
    desc: "Hubungkan akun Telegram, lalu kirim foto struk ke bot — transaksi tercatat otomatis tanpa perlu buka aplikasi."
  }
];

const EXTRA_FEATURES = [
  {
    icon: CalendarClock,
    tone: "gold",
    title: "Tagihan & Pengingat Jatuh Tempo",
    desc: "Catat tagihan rutin dan dapat pengingat begitu jatuh temponya tinggal 5 hari lagi, supaya tidak ada yang kelewat bayar."
  },
  {
    icon: Users,
    tone: "violet",
    title: "Arisan",
    desc: "Kelola grup arisan, peserta, riwayat setoran, sampai giliran menerima — semua tercatat rapi di satu tempat."
  },
  {
    icon: HandHeart,
    tone: "mint",
    title: "Zakat & Sedekah",
    desc: "Pencatatan zakat dan sedekah otomatis terpisah dari pengeluaran biasa, lengkap pelacakan konsistensi tiap bulan."
  }
];

const BUDGET_CATEGORIES = [
  { icon: HomeIcon, label: "Rumah Tangga" },
  { icon: HeartPulse, label: "Kesehatan" },
  { icon: Music2, label: "Hiburan" },
  { icon: PiggyBank, label: "Tabungan & Investasi" },
  { icon: HandCoins, label: "Ibadah & Sedekah" },
  { icon: Layers, label: "Lainnya" }
];

const HOW_IT_WORKS = [
  { title: "Catat pemasukan dan pengeluaran", desc: "Mulai dari transaksi hari ini, tidak perlu menunggu awal bulan atau gaji berikutnya." },
  { title: "Tentukan budget per kategori", desc: "Kasih batas wajar untuk tiap pos — rumah tangga, hiburan, tabungan, dan lainnya." },
  { title: "Pantau realisasi dan saldo", desc: "Lihat seberapa dekat pengeluaranmu dengan batas yang sudah ditentukan, kapan saja." },
  { title: "Evaluasi kebiasaan setiap bulan", desc: "Dari data yang tercatat, kamu jadi tahu pola mana yang perlu diperbaiki bulan depan." }
];

const ROADMAP_ITEMS = [
  { icon: FileText, title: "Laporan Bulanan", desc: "Ringkasan keuangan otomatis dikirim ke email tiap akhir bulan." }
];

const FAQ_ITEMS = [
  {
    q: "Apakah Fine Pro cocok untuk pemula?",
    a: "Cocok. Alurnya sengaja dibuat sederhana — catat transaksi, atur budget, pantau saldo. Tidak perlu paham istilah akuntansi untuk mulai memakainya."
  },
  {
    q: "Apakah ada uji coba gratis?",
    a: "Ada. Setiap akun baru otomatis dapat 14 hari gratis begitu selesai daftar — tanpa perlu kartu kredit atau info pembayaran apapun. Setelah masa coba selesai, data lamamu tetap bisa dilihat; kamu hanya perlu upgrade kalau mau lanjut mencatat transaksi baru."
  },
  {
    q: "Apakah bisa mencatat pemasukan dan pengeluaran?",
    a: "Bisa. Keduanya bisa dicatat lengkap dengan kategori, nominal, dan catatan tambahan, lalu langsung terlihat di dashboard."
  },
  {
    q: "Apakah bisa membuat budget?",
    a: "Bisa. Kamu bisa menentukan batas anggaran per kategori, lalu memantau realisasinya dibanding rencana setiap bulan."
  },
  {
    q: "Apakah bisa dipakai di HP?",
    a: "Bisa, tampilannya memang didesain mobile-first supaya nyaman dipakai satu tangan langsung dari browser HP."
  },
  {
    q: "Apakah ada mode gelap dan terang?",
    a: "Ada. Kamu bisa memilih tampilan yang paling nyaman di mata, siang atau malam."
  },
  {
    q: "Apakah data saya aman?",
    a: "Data disimpan di database milik Fine Pro dan hanya bisa diakses lewat akunmu sendiri setelah login. Kami tidak membagikan data transaksi ke pihak lain."
  }
];

const TONE_BG = {
  violet: "bg-violet-light text-violet",
  mint: "bg-mint-light text-mint",
  coral: "bg-coral-light text-coral",
  gold: "bg-gold-light text-gold"
};

function BrandLogo({ className = "" }) {
  return (
    <img
      src="/images/fine-pro-header.png"
      alt="Fine Pro"
      className={`h-10 w-auto object-contain ${className}`}
    />
  );
}

function SectionBrand({ align = "center", className = "" }) {
  const alignment = align === "left" ? "justify-start" : "justify-center";
  return (
    <div className={`mb-4 flex ${alignment} ${className}`}>
      <BrandLogo className="h-9 sm:h-10" />
    </div>
  );
}

function Container({ className = "", children }) {
  return <div className={`mx-auto w-full max-w-[1200px] px-5 md:px-8 ${className}`}>{children}</div>;
}

function SectionEyebrow({ children }) {
  return (
    <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-violet-light px-3 py-1 text-[11px] font-bold text-violet">
      <Sparkles size={12} />
      {children}
    </div>
  );
}

// Mockup dashboard murni HTML/CSS (Tailwind) — dipakai di Hero (lebih ringkas)
// dan section Preview App (lebih besar). Tidak ada gambar eksternal.
function DashboardMockup({ size = "hero" }) {
  const isFull = size === "full";
  return (
    <div
      className={`gloss-panel mx-auto rounded-[32px] p-4 ${isFull ? "w-full max-w-sm" : "w-full max-w-[280px]"}`}
      role="img"
      aria-label="Contoh tampilan dashboard Fine Pro dengan ringkasan saldo, budget, dan transaksi terbaru"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-navy text-xs font-bold text-white">FP</div>
          <div className="text-xs font-bold text-navy">Dashboard</div>
        </div>
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/70 text-neutral-500">
          <Sun size={13} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-mint-light p-2.5">
          <div className="text-[9px] font-semibold text-mint">Pemasukan</div>
          <div className="mt-1 text-[11px] font-bold text-navy">Rp8,4jt</div>
        </div>
        <div className="rounded-2xl bg-coral-light p-2.5">
          <div className="text-[9px] font-semibold text-coral">Pengeluaran</div>
          <div className="mt-1 text-[11px] font-bold text-navy">Rp5,1jt</div>
        </div>
        <div className="rounded-2xl bg-violet-light p-2.5">
          <div className="text-[9px] font-semibold text-violet">Saldo</div>
          <div className="mt-1 text-[11px] font-bold text-navy">Rp3,3jt</div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/70 bg-white/60 p-3">
        <div className="mb-2 flex items-center justify-between text-[10px] font-bold text-navy">
          <span>Budget vs Realisasi</span>
          <span className="text-neutral-500">Bulan ini</span>
        </div>
        {[
          { label: "Rumah Tangga", pct: 62, tone: "bg-mint" },
          { label: "Hiburan", pct: 88, tone: "bg-gold" },
          { label: "Tabungan", pct: 40, tone: "bg-violet" }
        ].map((row) => (
          <div key={row.label} className="mb-2 last:mb-0">
            <div className="mb-1 flex items-center justify-between text-[9px] font-semibold text-neutral-500">
              <span>{row.label}</span>
              <span>{row.pct}%</span>
            </div>
            <div className="soft-progress">
              <div className={`h-2 rounded-full ${row.tone}`} style={{ width: `${row.pct}%` }} />
            </div>
          </div>
        ))}
      </div>

      {isFull && (
        <div className="mt-4 rounded-2xl border border-white/70 bg-white/60 p-3">
          <div className="mb-2 text-[10px] font-bold text-navy">Transaksi Terbaru</div>
          {[
            { name: "Belanja Bulanan", cat: "Rumah Tangga", amount: "-Rp320rb", tone: "text-coral" },
            { name: "Freelance Desain", cat: "Pemasukan", amount: "+Rp1,2jt", tone: "text-mint" },
            { name: "Sedekah Jumat", cat: "Ibadah & Sedekah", amount: "-Rp50rb", tone: "text-coral" }
          ].map((tx) => (
            <div key={tx.name} className="flex items-center justify-between border-t border-neutral-border/60 py-1.5 first:border-0 first:pt-0">
              <div>
                <div className="text-[10px] font-semibold text-navy">{tx.name}</div>
                <div className="text-[9px] text-neutral-500">{tx.cat}</div>
              </div>
              <div className={`text-[10px] font-bold ${tx.tone}`}>{tx.amount}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NavBar({ onGetStarted, onLogin }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-white/60 bg-white/75 backdrop-blur-xl">
      <Container className="flex h-16 items-center justify-between">
        <a href="#" className="flex items-center" aria-label="Fine Pro">
          <BrandLogo className="h-9 sm:h-10" />
        </a>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Navigasi utama">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="text-sm font-semibold text-neutral-700 transition hover:text-violet">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <button type="button" onClick={onLogin} className="text-sm font-medium text-neutral-500 hover:text-violet">
            Masuk
          </button>
          <button
            type="button"
            onClick={onGetStarted}
            className="flex h-10 items-center gap-1.5 rounded-full bg-violet px-4 text-sm font-bold text-white shadow-float transition hover:brightness-110"
          >
            Coba Fine Pro
            <ArrowRight size={15} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Tutup menu" : "Buka menu"}
          aria-expanded={open}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-navy md:hidden"
        >
          {open ? <X size={19} /> : <Menu size={19} />}
        </button>
      </Container>

      {open && (
        <div className="border-t border-white/60 bg-white/95 px-5 py-4 md:hidden">
          <nav className="flex flex-col gap-3" aria-label="Navigasi mobile">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="text-sm font-semibold text-neutral-700"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-2">
            <span className="mx-auto flex items-center gap-1 rounded-full bg-mint-light px-3 py-1.5 text-xs font-bold text-mint">
              <Gift size={13} />
              14 Hari Gratis · Tanpa Kartu Kredit
            </span>
            <button
              type="button"
              onClick={() => { setOpen(false); onGetStarted(); }}
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-violet text-sm font-bold text-white"
            >
              Mulai Gratis 14 Hari
              <ArrowRight size={15} />
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); onLogin(); }}
              className="mx-auto text-sm font-medium text-neutral-500 hover:text-violet"
            >
              Sudah punya akun? Masuk
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

function Hero({ onGetStarted }) {
  return (
    <section className="py-12 md:py-20">
      <Container className="grid items-center gap-10 md:grid-cols-2">
        <div>
          <div className="mb-5 flex justify-start">
            <BrandLogo className="h-[108px] max-w-full sm:h-[120px] md:h-[132px]" />
          </div>
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-mint-light px-3 py-1 text-[11px] font-bold text-mint">
            <Gift size={12} />
            Coba Gratis 14 Hari, Tanpa Kartu Kredit
          </div>
          <h1 className="text-3xl font-bold leading-tight text-navy sm:text-4xl md:text-[2.75rem]">
            Uang Sering Habis Tapi Tidak Tahu Ke Mana Perginya?
          </h1>
          <p className="mt-4 text-base font-medium leading-relaxed text-neutral-500 md:text-lg">
            Fine Pro membantu kamu mencatat pemasukan, pengeluaran, saldo, dan budget harian agar keuangan lebih
            terkendali — langsung dari HP.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onGetStarted}
              className="flex h-12 items-center justify-center gap-1.5 rounded-full bg-violet px-6 text-sm font-bold text-white shadow-float transition hover:brightness-110"
            >
              Mulai Gratis 14 Hari
              <ArrowRight size={16} />
            </button>
            <a
              href="#fitur"
              className="flex h-12 items-center justify-center gap-1.5 rounded-full border border-navy px-6 text-sm font-bold text-navy"
            >
              Lihat Fitur
            </a>
          </div>

          <p className="mt-4 text-xs font-semibold text-neutral-500">
            Gratis 14 hari · Tanpa kartu kredit · Batal kapan saja
          </p>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 -z-10 rounded-[40px] bg-gradient-to-br from-violet-light via-mint-light to-transparent blur-2xl" />
          <DashboardMockup size="hero" />
        </div>
      </Container>
    </section>
  );
}

function PainPoints() {
  return (
    <section id="masalah" className="py-14 md:py-20">
      <Container>
        <div className="mx-auto max-w-xl text-center">
          <SectionEyebrow>Rasanya familier?</SectionEyebrow>
          <h2 className="text-2xl font-bold text-navy md:text-3xl">Masalah Keuangan yang Sering Terjadi</h2>
          <p className="mt-3 text-sm font-medium text-neutral-500 md:text-base">
            Kalau salah satu ini terasa dekat denganmu, kamu tidak sendirian — dan bukan berarti kamu buruk mengatur uang.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PAIN_POINTS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="gloss-panel rounded-3xl p-5">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${TONE_BG[item.tone]}`}>
                  <Icon size={18} />
                </div>
                <h3 className="mt-4 text-sm font-bold text-navy">{item.title}</h3>
                <p className="mt-1.5 text-xs font-medium leading-relaxed text-neutral-500">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

function Solution() {
  return (
    <section className="py-14 md:py-20">
      <Container className="gloss-panel rounded-[32px] p-6 md:p-10">
        <div className="mx-auto max-w-xl text-center">
          <SectionBrand />
          <SectionEyebrow>Solusinya</SectionEyebrow>
          <h2 className="text-2xl font-bold text-navy md:text-3xl">Fine Pro Membantu Kamu Melihat Uang dengan Lebih Jelas</h2>
        </div>

        <div className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-2">
          {SOLUTION_POINTS.map((point) => (
            <div key={point} className="flex items-start gap-2.5 rounded-2xl bg-white/60 p-3">
              <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-mint-light text-mint">
                <Check size={12} />
              </div>
              <span className="text-sm font-semibold leading-relaxed text-navy">{point}</span>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Features() {
  return (
    <section id="fitur" className="py-14 md:py-20">
      <Container>
        <div className="mx-auto max-w-xl text-center">
          <SectionEyebrow>Fitur utama</SectionEyebrow>
          <h2 className="text-2xl font-bold text-navy md:text-3xl">Semua yang Kamu Butuhkan untuk Mulai Rapi</h2>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="gloss-panel rounded-3xl p-5">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${TONE_BG[f.tone]}`}>
                  <Icon size={18} />
                </div>
                <h3 className="mt-4 text-sm font-bold text-navy">{f.title}</h3>
                <p className="mt-1.5 text-xs font-medium leading-relaxed text-neutral-500">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

function BudgetCategorySection() {
  return (
    <section className="py-14 md:py-20">
      <Container className="gloss-panel rounded-[32px] p-6 md:p-10">
        <div className="mx-auto max-w-xl text-center">
          <SectionBrand />
          <SectionEyebrow>Bukan sekadar angka</SectionEyebrow>
          <h2 className="text-2xl font-bold text-navy md:text-3xl">Budget yang Lebih Manusiawi</h2>
          <p className="mt-3 text-sm font-medium leading-relaxed text-neutral-500 md:text-base">
            Fine Pro tidak cuma mencatat uang, tapi membantu membagi pengeluaran berdasarkan kategori kehidupan sehari-hari.
          </p>
        </div>

        <div className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-3">
          {BUDGET_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <div key={cat.label} className="flex items-center gap-2 rounded-full bg-white/70 px-4 py-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-light text-violet">
                  <Icon size={14} />
                </div>
                <span className="text-xs font-bold text-navy">{cat.label}</span>
              </div>
            );
          })}
        </div>

        <p className="mx-auto mt-8 max-w-lg text-center text-sm font-semibold leading-relaxed text-navy">
          Pengguna bisa melihat kategori mana yang aman, mana yang mulai bocor, dan mana yang perlu dikendalikan.
        </p>
      </Container>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="cara-kerja" className="py-14 md:py-20">
      <Container>
        <div className="mx-auto max-w-xl text-center">
          <SectionEyebrow>Simpel dari awal</SectionEyebrow>
          <h2 className="text-2xl font-bold text-navy md:text-3xl">Cara Kerja Fine Pro</h2>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((step, i) => (
            <div key={step.title} className="gloss-panel rounded-3xl p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
                {i + 1}
              </div>
              <h3 className="mt-4 text-sm font-bold text-navy">{step.title}</h3>
              <p className="mt-1.5 text-xs font-medium leading-relaxed text-neutral-500">{step.desc}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function PreviewApp() {
  return (
    <section id="preview" className="py-14 md:py-20">
      <Container className="grid items-center gap-10 md:grid-cols-2">
        <div className="order-2 md:order-1">
          <SectionBrand align="left" />
          <SectionEyebrow>Tampilan asli</SectionEyebrow>
          <h2 className="text-2xl font-bold text-navy md:text-3xl">Lihat Sekilas Dashboard Fine Pro</h2>
          <p className="mt-3 text-sm font-medium leading-relaxed text-neutral-500 md:text-base">
            Ringkasan pemasukan, pengeluaran, saldo, progress budget, dan transaksi terbaru — semua dalam satu layar
            yang gampang dibaca, dalam mode terang yang ramah untuk siapa saja.
          </p>
          <ul className="mt-5 flex flex-col gap-2 text-sm font-semibold text-navy">
            <li className="flex items-center gap-2"><Check size={14} className="text-mint" /> Ringkasan pemasukan &amp; pengeluaran</li>
            <li className="flex items-center gap-2"><Check size={14} className="text-mint" /> Progress budget per kategori</li>
            <li className="flex items-center gap-2"><Check size={14} className="text-mint" /> Daftar transaksi terbaru</li>
          </ul>
        </div>
        <div className="order-1 md:order-2">
          <DashboardMockup size="full" />
        </div>
      </Container>
    </section>
  );
}

function SmartAutomation() {
  return (
    <section className="py-14 md:py-20">
      <Container>
        <div className="mx-auto max-w-xl text-center">
          <SectionEyebrow>Otomatis, bukan manual</SectionEyebrow>
          <h2 className="text-2xl font-bold text-navy md:text-3xl">Catat Transaksi Tanpa Ribet</h2>
          <p className="mt-3 text-sm font-medium leading-relaxed text-neutral-500 md:text-base">
            Tidak perlu ketik satu-satu — cukup foto, sisanya dibantu AI.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {SMART_FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="gloss-panel rounded-3xl p-6">
                <div className={`flex h-11 w-11 items-center justify-center rounded-full ${TONE_BG[f.tone]}`}>
                  <Icon size={20} />
                </div>
                <h3 className="mt-4 text-base font-bold text-navy">{f.title}</h3>
                <p className="mt-1.5 text-sm font-medium leading-relaxed text-neutral-500">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

function ExtraFeatures() {
  return (
    <section className="py-14 md:py-20">
      <Container>
        <div className="mx-auto max-w-xl text-center">
          <SectionEyebrow>Kebutuhan sehari-hari</SectionEyebrow>
          <h2 className="text-2xl font-bold text-navy md:text-3xl">Fitur Tambahan untuk Hidup yang Lebih Rapi</h2>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EXTRA_FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="gloss-panel rounded-3xl p-5">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${TONE_BG[f.tone]}`}>
                  <Icon size={18} />
                </div>
                <h3 className="mt-4 text-sm font-bold text-navy">{f.title}</h3>
                <p className="mt-1.5 text-xs font-medium leading-relaxed text-neutral-500">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

function QuickFacts() {
  return (
    <section className="pb-2">
      <Container className="flex flex-wrap items-center justify-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3.5 py-2 text-xs font-bold text-navy">
          <LogIn size={13} className="text-violet" /> Masuk cepat dengan Google
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3.5 py-2 text-xs font-bold text-navy">
          <Download size={13} className="text-mint" /> Bisa diinstall sebagai aplikasi (PWA)
        </span>
      </Container>
    </section>
  );
}

function Roadmap() {
  return (
    <section className="py-14 md:py-20">
      <Container>
        <div className="mx-auto max-w-xl text-center">
          <SectionEyebrow>Terus berkembang</SectionEyebrow>
          <h2 className="text-2xl font-bold text-navy md:text-3xl">Sedang Dikembangkan</h2>
          <p className="mt-3 text-sm font-medium leading-relaxed text-neutral-500 md:text-base">
            Beberapa fitur berikut sedang disiapkan agar Fine Pro semakin membantu dalam mengelola keuangan.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROADMAP_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-3xl border border-dashed border-neutral-border bg-white/50 p-5">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-light text-gold">
                    <Icon size={16} />
                  </div>
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-bold text-neutral-500">
                    Segera hadir
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-bold text-navy">{item.title}</h3>
                <p className="mt-1.5 text-xs font-medium leading-relaxed text-neutral-500">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

function CtaSection({ onGetStarted }) {
  return (
    <section className="py-14 md:py-20">
      <Container>
        <div className="gloss-panel rounded-[32px] bg-gradient-to-br from-navy to-violet p-8 text-center text-white md:p-14">
          <div className="mb-5 flex justify-center">
            <div className="rounded-2xl bg-white/95 px-4 py-2 shadow-soft">
              <BrandLogo className="h-10 sm:h-12" />
            </div>
          </div>
          <h2 className="text-2xl font-bold md:text-4xl">Mulai Rapikan Keuanganmu Hari Ini</h2>
          <p className="mx-auto mt-3 max-w-md text-sm font-medium leading-relaxed text-white/80 md:text-base">
            Tidak perlu menunggu gaji berikutnya. Coba gratis 14 hari, tanpa kartu kredit — cukup email untuk mulai.
          </p>
          <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={onGetStarted}
              className="flex h-12 w-full items-center justify-center gap-1.5 rounded-full bg-white px-6 text-sm font-bold text-navy sm:w-auto"
            >
              Mulai Gratis 14 Hari
              <ArrowRight size={16} />
            </button>
            <a
              href="#preview"
              className="flex h-12 w-full items-center justify-center gap-1.5 rounded-full border border-white/60 px-6 text-sm font-bold text-white sm:w-auto"
            >
              Lihat Demo Dashboard
            </a>
          </div>
          <p className="mt-4 text-xs font-semibold text-white/70">
            14 hari gratis · Tanpa kartu kredit · Batal kapan saja
          </p>
        </div>
      </Container>
    </section>
  );
}

function FaqItem({ item, open, onToggle, index }) {
  return (
    <div className="gloss-panel rounded-2xl p-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`faq-panel-${index}`}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-sm font-bold text-navy">{item.q}</span>
        <ChevronDown size={17} className={`flex-shrink-0 text-violet transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <p id={`faq-panel-${index}`} className="mt-3 text-sm font-medium leading-relaxed text-neutral-500">
          {item.a}
        </p>
      )}
    </div>
  );
}

function Faq() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section id="faq" className="py-14 md:py-20">
      <Container className="max-w-2xl">
        <div className="text-center">
          <SectionEyebrow>Pertanyaan umum</SectionEyebrow>
          <h2 className="text-2xl font-bold text-navy md:text-3xl">FAQ</h2>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          {FAQ_ITEMS.map((item, i) => (
            <FaqItem
              key={item.q}
              item={item}
              index={i}
              open={openIndex === i}
              onToggle={() => setOpenIndex((prev) => (prev === i ? -1 : i))}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}

function Footer({ onLogin }) {
  return (
    <footer className="border-t border-white/60 bg-white/60 py-10">
      <Container className="flex flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left">
        <div>
          <div className="flex items-center justify-center md:justify-start">
            <BrandLogo className="h-10" />
          </div>
          <p className="mt-2 text-xs font-medium text-neutral-500">Keuangan Lebih Rapi, Hidup Lebih Tenang.</p>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-semibold text-neutral-500" aria-label="Navigasi footer">
          <a href="#fitur" className="hover:text-violet">Fitur</a>
          <a href="#faq" className="hover:text-violet">FAQ</a>
          <a href="/privacy" className="hover:text-violet">Kebijakan Privasi</a>
          <a href="mailto:hello@finepro.my.id" className="hover:text-violet">Kontak</a>
          <button type="button" onClick={onLogin} className="hover:text-violet">Masuk</button>
          <button type="button" onClick={openPrivacySettings} className="hover:text-violet">Pengaturan Privasi</button>
        </nav>
      </Container>
      <Container className="mt-6 border-t border-neutral-border/60 pt-4">
        <p className="text-center text-[11px] font-medium text-neutral-400">
          © {new Date().getFullYear()} Fine Pro. Seluruh hak cipta dilindungi.
        </p>
      </Container>
    </footer>
  );
}

export default function LandingPage({ onGetStarted, onLogin }) {
  const { trackEvent } = useTracking() || {};

  // Smooth scroll khusus selama landing page aktif — dibersihkan lagi saat
  // unmount supaya tidak mengubah perilaku scroll di halaman app/dashboard.
  useEffect(() => {
    const prev = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "smooth";
    return () => { document.documentElement.style.scrollBehavior = prev; };
  }, []);

  useEffect(() => {
    trackEvent?.("view_landing_page", { parameters: { content_name: "landing_page", page_path: "/" } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleGetStarted(source) {
    trackEvent?.("primary_cta_clicked", { parameters: { content_name: source || "get_started", method: "cta" } });
    onGetStarted();
  }

  return (
    <div className="app-glow-bg min-h-screen overflow-x-hidden">
      <NavBar onGetStarted={() => handleGetStarted("navbar")} onLogin={onLogin} />
      <Hero onGetStarted={() => handleGetStarted("hero")} />
      <PainPoints />
      <Solution />
      <Features />
      <BudgetCategorySection />
      <HowItWorks />
      <PreviewApp />
      <SmartAutomation />
      <ExtraFeatures />
      <QuickFacts />
      <Roadmap />
      <CtaSection onGetStarted={() => handleGetStarted("cta_section")} />
      <Faq />
      <Footer onLogin={onLogin} />
    </div>
  );
}
