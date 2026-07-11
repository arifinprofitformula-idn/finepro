# Keuangan Keluarga — Coach Arifin

PWA pencatatan keuangan untuk keluarga (suami-istri), mahasiswa, dan individu. Ringan (Vite + Vanilla JS + Alpine.js), auth & database via Supabase, bisa "Add to Home Screen" tanpa Play Store.

## Menjalankan di Lokal (VS Code)

```bash
npm install
cp .env.example .env    # lalu isi VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY
npm run dev
```
Buka `http://localhost:5173`.

## Setup Database (sekali saja, project Supabase baru)

Di Supabase SQL Editor, jalankan berurutan:
1. `supabase/schema.sql`
2. `supabase/migrations/002_add_persona_categories.sql`

## Build untuk Produksi

```bash
npm run build      # hasil di folder dist/
npm run preview    # uji hasil build secara lokal sebelum deploy
```

## Deploy

Lihat `docs/PANDUAN-DEPLOY-VPS.md` (VPS sendiri, Ubuntu + Nginx + Let's Encrypt) atau jalankan `docs/deploy-vps-ubuntu.sh` di VPS setelah `npm run build` dan upload folder `dist/`.

## Struktur Project

```
src/
├── main.js              # entry point, state Alpine.js, menyambungkan lib <-> UI
├── lib/                  # logika data & Supabase (auth, households, categories, transactions, budgets, subscriptions)
├── pages/                # controller per layar (mengambil & menyiapkan data untuk ditampilkan)
├── components/           # unit UI yang bisa dipakai ulang (mis. chart kategori)
├── utils/                # helper murni (format angka, tanggal)
└── styles/                # CSS, dipisah base (reset & variabel) dan components (UI)
```

## Status Fitur (mengikuti roadmap MVP)

- [x] Fase 1: Auth, catat transaksi manual, dashboard KPI + chart kategori
- [x] Fase 2: Onboarding pilih persona (Keluarga / Mahasiswa / Individu), kategori otomatis menyesuaikan
- [ ] Fase 3: Undang anggota keluarga (kolaborasi suami-istri)
- [ ] Fase 4: Pengingat & reminder khusus mahasiswa
- [ ] Fase 5: Notifikasi budget, laporan bulanan otomatis, export
- [ ] Fase 6: Payment gateway (Midtrans/Xendit) untuk otomasi langganan

Detail tiap fase ada di `RENCANA-MIGRASI-ROADMAP.md` (folder induk, di luar project ini).

## Keamanan

- `VITE_SUPABASE_ANON_KEY` aman ditaruh di frontend — perlindungan data sesungguhnya ada di Row Level Security (RLS) pada database, sudah diatur di `supabase/schema.sql` dan `supabase/migrations/002_add_persona_categories.sql`.
- Jangan pernah menaruh `service_role key` Supabase di kode frontend.
