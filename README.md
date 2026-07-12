# Keuangan Keluarga — Coach Arifin

PWA pencatatan keuangan untuk keluarga (suami-istri), mahasiswa, dan individu. Ringan (Vite + Vanilla JS + Alpine.js), auth & database via Express.js + PostgreSQL lokal, bisa "Add to Home Screen" tanpa Play Store.

## Menjalankan di Lokal sebagai Development

Aplikasi ini dipakai dalam mode development lokal dengan dua proses:

- Frontend Vite: `http://localhost:5173`
- Backend Express API: `http://127.0.0.1:3001`

Saat development, frontend memanggil endpoint relatif `/api`, lalu Vite meneruskan request ke backend lokal lewat proxy. Jangan gunakan `npm run build` untuk kerja harian; itu hanya untuk final/produksi.

```bash
npm install
npm run dev
```

Di terminal kedua:

```bash
cd api
npm install
npm run dev
```

Isi `.env` di root project dengan kredensial PostgreSQL lokal. Buka `http://localhost:5173`.

## Integrasi AI

Provider utama AI adalah SumoPod AI API yang kompatibel dengan OpenAI SDK:

```env
AI_PROVIDER=sumopod
SUMOPOD_API_KEY=isi-sumopod-api-key
SUMOPOD_BASE_URL=https://ai.sumopod.com/v1
SUMOPOD_MODEL=gpt-4o-mini
```

Anthropic tetap tersedia sebagai alternatif lewat Admin Console dengan `ANTHROPIC_API_KEY`.

## Setup Database Lokal

Jalankan script SQL berikut ke PostgreSQL lokal:
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
├── lib/                  # client API dan logika data (auth, households, categories, transactions, budgets, subscriptions)
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

- `.env` hanya untuk development lokal dan sudah diabaikan Git.
- Jangan menaruh secret produksi di kode frontend.
