# Konteks Project: Keuangan Keluarga (Coach Arifin)

## Apa project ini

PWA pencatatan keuangan untuk keluarga (suami-istri), mahasiswa, dan individu.
Bahasa produk dan komunikasi user-facing: Bahasa Indonesia.

Root repo ini **adalah** project-nya (Vite + Vanilla JS + Alpine.js di
frontend, Supabase sebagai backend — Postgres + Auth + RLS). Tidak ada
server aplikasi custom.

```
├── index.html            # shell HTML, x-data="appState()"
├── src/
│   ├── main.js            # entry point, state Alpine.js, menyambungkan lib <-> UI
│   ├── lib/                # logika data & Supabase (auth, households, categories, transactions, budgets, subscriptions)
│   ├── pages/               # controller per layar (ambil & siapkan data untuk ditampilkan)
│   ├── components/          # unit UI reusable (mis. categoryChart.js)
│   ├── utils/                # helper murni (format angka, tanggal)
│   └── styles/                # base.css (reset & variabel) + components.css (UI)
├── public/                # icon-192.png, icon-512.png — disalin apa adanya ke root saat build
├── supabase/
│   ├── schema.sql          # skema awal (households, household_members, transactions, budgets, subscriptions + RLS)
│   └── migrations/002_add_persona_categories.sql   # tambahan: household_type + tabel categories
├── docs/                  # PANDUAN-DEPLOY-VPS.md, deploy-vps-ubuntu.sh, nginx-keuangan.conf — TIDAK diupload ke VPS
├── .env / .env.example    # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (.env tidak di-commit)
└── package.json           # scripts: dev, build, preview
```

## Model data inti

- Satu user → 1 household (via `household_members`)
- Household dibuat lewat layar onboarding persona (family / student /
  individual) — trigger database otomatis mengisi: keanggotaan owner,
  subscription trial 14 hari, dan seed `categories` sesuai `household_type`
  (lihat `002_add_persona_categories.sql`)
- Semua query transaksi/budget difilter `household_id`; RLS di database
  yang menjamin isolasi antar household, bukan logika di frontend

## Batasan teknis (JANGAN dilanggar)

1. **Deploy hanya ke VPS Linux** milik Coach Arifin (Ubuntu + Nginx +
   Certbot). Jangan usulkan Vercel/Netlify/platform serverless lain kecuali
   diminta eksplisit. Yang diupload ke VPS adalah hasil `npm run build`
   (folder `dist/`), bukan source code. `src/`, `supabase/`, `docs/`,
   `.env`, `package.json`, dll. tidak pernah disajikan Nginx.
2. **Satu sumber kebenaran data: Supabase**, difilter per `household_id`,
   dilindungi RLS. Jangan membuat versi paralel berbasis localStorage.
3. **Perubahan skema database lewat file baru di `supabase/migrations/`**
   (pola sudah ada: `002_add_persona_categories.sql`), jangan edit
   `schema.sql` untuk perubahan setelah rilis awal — treat sebagai snapshot
   awal, migrasi berikutnya nomor urut berikutnya. Setiap tabel baru wajib
   RLS + policy mengikuti pola household-based yang sudah ada.
4. **Jangan taruh `service_role key` di kode frontend manapun.** Hanya
   `VITE_SUPABASE_ANON_KEY` di `.env` (tidak di-commit).
5. Kalau menambah dependency atau mengubah `vite.config.js` (mis. nama
   file manifest/service worker dari `vite-plugin-pwa`), sinkronkan juga
   aturan cache/block di `docs/nginx-keuangan.conf` dan
   `docs/deploy-vps-ubuntu.sh` — jangan biarkan keduanya menyimpang dari
   konfigurasi build yang sebenarnya.
6. Bahasa UI, pesan error, dokumentasi user-facing: **Bahasa Indonesia**.
   Kategori transaksi per persona (di tabel `categories` via migrasi)
   domain-specific untuk Coach Arifin — jangan diubah tanpa konfirmasi user.

## Yang TIDAK relevan untuk project ini

Jangan bawa masuk konteks dari project Coach yang lain (EPIC Hub, VaultMind,
FinPlan Pro, poster generator EPI, Sistem Validasi Tandatangan Dokumen,
dsb) kecuali diminta eksplisit.

## Kalau ragu

Tanya dulu sebelum menambah dependency, mengubah struktur folder, atau
memperluas scope fitur (kolaborasi keluarga, reminder mahasiswa, payment
gateway, dst.) di luar MVP yang berjalan sekarang — validasi dulu sebelum
membangun fase berikutnya.
