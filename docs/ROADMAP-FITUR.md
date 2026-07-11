# Roadmap Fitur — Keuangan Keluarga

Status per fitur ditandai jelas supaya dokumen ini tidak basi lagi seperti
versi sebelumnya. Prinsip MVP tetap berlaku: validasi tiap fase sebelum
lanjut, jangan bangun semua sekaligus.

**Stack saat ini: React + Tailwind CSS (frontend), Express + PostgreSQL
self-hosted di VPS (backend).** Bukan lagi Vanilla JS + Alpine.js, dan
bukan Supabase — kedua hal itu adalah arsitektur versi sangat awal proyek
ini dan sudah sepenuhnya digantikan.

---

## Fase 1-2 — Baseline & Onboarding Persona
✅ **Selesai.** Login/daftar, catat transaksi, dashboard KPI, chart kategori,
onboarding pilih persona (family/student/individual) dengan seed kategori
otomatis per tipe.

## Fase 3 — Kolaborasi Keluarga
- ✅ **Undang anggota lewat email** — sudah jalan (`api/routes/invites.js`,
  tabel `household_invites`). Bukan lewat email notifikasi otomatis saat ini
  (belum ada Fase pengiriman email undangan) — anggota cek undangan pending
  manual di halaman Akun/onboarding.
- ✅ **Label "Dicatat oleh"** — sudah tampil di tiap transaksi.
- ⬜ **Ringkasan kontribusi per anggota** — belum dibangun. Tetap opsional
  sesuai catatan asli (sensitif, beri opsi sembunyikan).

## Fase 4 — Multi-Dompet, Transfer & Kebutuhan Mahasiswa
- ⬜ **Multi-dompet (tabel `wallets`)** — belum dibangun. Saat ini semua
  transaksi masih satu saldo per household, belum dipisah Tunai/Bank/e-wallet.
- ⬜ **Transfer antar dompet** — belum ada (bergantung pada multi-dompet di atas).
- ✅ **Reminder uang bulanan** — sudah jalan, khusus household `student`
  (`monthly_income_day` + banner pengingat di dashboard).
- ✅ **Kategori kos/kuota/buku mahasiswa** — sudah ter-seed otomatis dari
  onboarding persona, plus quick-add chip kategori mahasiswa di modal
  tambah transaksi.
- ⬜ **Tier harga lebih murah untuk mahasiswa** — belum ada. Harga saat ini
  flat (Rp29.000/bulan, Rp149.000/6bln, Rp249.000/tahun) untuk semua
  persona, belum disegmentasi. Terkait langsung dengan keputusan harga di
  Fase 6 — sebaiknya diputuskan bersamaan, bukan terpisah.

## Fase 5 — Retensi & Insight
- ⬜ **Notifikasi budget mendekati/lewat batas (push)** — belum ada. Yang
  sudah ada baru indikator visual (ring warna di dashboard: hijau/kuning/
  merah), bukan push notification.
- ⬜ **Tagihan & pengingat jatuh tempo (tabel `bills`)** — belum dibangun.
- 🟡 **Pos Zakat/Sedekah** — kategori "Ibadah & Sedekah" sudah ada di seed
  default household `family`, tapi belum ada widget ringkasan "sudah
  bersedekah berapa bulan ini" di dashboard. Separuh jalan.
- ⬜ **Arisan & Iuran** — belum dibangun.
- ⬜ **Scan struk otomatis (AI/Claude vision)** — belum dibangun.
- ✅ **Laporan bulanan otomatis via email** — sudah jalan
  (`api/jobs/monthlyReport.js`, cron OS, kirim via Mailketing). Perlu
  kredensial Mailketing production diisi di VPS sebelum aktif (lihat
  `docs/CHECKLIST-LAUNCH.md`).
- ✅ **Export CSV** — sudah jalan (transaksi bulan berjalan, dari halaman Akun).
- ⬜ **Export PDF** — belum dibangun.

## Fase 6 — Monetisasi Penuh
- ✅ **Integrasi payment gateway (Midtrans)** — sudah jalan penuh: buat
  transaksi, webhook tervalidasi signature, auto-extend masa aktif,
  auto-expire saat `current_period_end` lewat.
- ✅ **Halaman Akun**: ubah plan (upgrade), invite anggota (family) — sudah
  ada. 🟡 **Riwayat pembayaran** belum ditampilkan ke user (data `payments`
  sudah tersimpan di database, tinggal dibuatkan UI list-nya).
- ⬜ **Keputusan harga vs kompetitor** — **masih tertunda, belum diputuskan.**
  Kompetitor "Uang Ayas" Rp30.000/tahun atau Rp99.000/lifetime, jauh di
  bawah tier kita Rp29.000/**bulan**. Ini keputusan bisnis, bukan teknis —
  perlu Anda putuskan: bersaing di harga, atau bertahan premium dengan
  kedalaman fitur (AI assistant, edukasi finansial, dst). Keputusan ini
  akan memengaruhi juga poin "tier harga mahasiswa" di Fase 4.

---

## Ringkasan: apa yang paling masuk akal dikerjakan berikutnya

Urutan berdasarkan yang paling murah untuk dibangun dan paling menutup gap
nyata dari yang sudah ada (bukan urutan mengikat, murni saran):

1. **Riwayat pembayaran di halaman Akun** — datanya sudah ada di database,
   tinggal UI. Termurah dari semua yang tersisa.
2. **Keputusan harga (Fase 6)** — bukan kerjaan coding, tapi memblokir
   keputusan produk lain (tier mahasiswa). Selesaikan ini duluan secara
   bisnis sebelum fitur harga-terkait dibangun.
3. **Tagihan & pengingat jatuh tempo** — nilai retensi tinggi, skema
   database-nya relatif sederhana (mirip pola `budgets`/`subscriptions`
   yang sudah ada).
4. **Multi-dompet & transfer** — perubahan skema lebih besar (semua query
   transaksi perlu tahu soal `wallet_id`), sebaiknya di-scope terpisah
   dan diriset dulu seberapa penting ini buat user nyata sebelum dibangun.
5. Sisanya (arisan, scan struk AI, push notification, export PDF, widget
   zakat) — validasi dulu ada permintaan nyata dari user sebelum dibangun,
   sesuai prinsip MVP yang sudah dipegang sejak awal proyek ini.
