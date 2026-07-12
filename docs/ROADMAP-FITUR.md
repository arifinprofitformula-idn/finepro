# Roadmap Fitur — Keuangan Keluarga

Status per fitur ditandai jelas supaya dokumen ini tidak basi. Semua item
di bawah sudah dibangun & diverifikasi (smoke-test end-to-end lewat API,
`npm run build` sukses tiap fitur) per 2026-07-11.

**Stack: React + Tailwind CSS (frontend), Express + PostgreSQL self-hosted
di VPS (backend).**

---

## Fase 1-2 — Baseline & Onboarding Persona
✅ **Selesai.** Login/daftar, catat transaksi, dashboard KPI, chart kategori,
onboarding pilih persona (family/student/individual) dengan seed kategori
otomatis per tipe.

## Fase 3 — Kolaborasi Keluarga
- ✅ **Undang anggota lewat email** — `api/routes/invites.js`.
- ✅ **Label "Dicatat oleh"** — tampil di tiap transaksi.
- ✅ **Ringkasan kontribusi per anggota** — `GET /api/transactions/contributions`,
  card di dashboard khusus household `family`, default **tersembunyi**
  (sensitif), toggle tersimpan di `localStorage`, bukan flag database.

## Fase 4 — Multi-Dompet, Transfer & Kebutuhan Mahasiswa
- ✅ **Multi-dompet** — tabel `wallets`, migrasi `008_wallets.sql` (auto-buat
  wallet "Tunai" default untuk household lama & baru). Saldo dihitung
  on-the-fly dari transaksi + transfer, bukan kolom tersimpan.
- ✅ **Transfer antar dompet** — tabel `wallet_transfers` terpisah dari
  `transactions` (tidak memengaruhi total income/expense), validasi saldo
  cukup sebelum transfer diproses.
- ✅ **Reminder uang bulanan** — khusus household `student`.
- ✅ **Kategori kos/kuota/buku mahasiswa** — seed otomatis + quick-add chip.
- ✅ **Tier harga mahasiswa** — **diputuskan TIDAK dibuat.** Keputusan bisnis
  (2026-07-11): tetap premium, harga sekarang tidak berubah untuk semua
  persona. Bukan celah yang belum dikerjakan — ini keputusan final.

## Fase 5 — Retensi & Insight
- ✅ **Notifikasi push budget mendekati/lewat batas** — Web Push (VAPID
  self-generated, bukan credential eksternal). Backend deteksi
  before/after saat insert transaksi expense (`api/lib/webpush.js`,
  `crossedThreshold()`), kirim sekali per crossing 80%/100%, stateless
  (tanpa tabel dedupe). Service worker dipindah dari mode `generateSW` ke
  `injectManifest` (`src/sw.js` custom) supaya bisa handle `push`/
  `notificationclick` — precache tetap NetworkOnly untuk `/api/*`.
- ✅ **Tagihan & pengingat jatuh tempo** — tabel `bills`, migrasi
  `007_bills.sql`. Tandai lunas: kalau `is_recurring`, jatuh tempo otomatis
  maju +1 bulan; kalau bukan, cukup `paid_at`. Banner pengingat di
  dashboard untuk tagihan ≤3 hari lagi (termasuk yang sudah telat).
- ✅ **Pos Zakat/Sedekah** — widget ringkasan bulan berjalan di dashboard
  (household `family`), murni derived dari `byCategory["Ibadah & Sedekah"]`
  yang sudah difetch, tanpa endpoint baru.
- ✅ **Arisan & Iuran** — tabel `arisan_groups`/`arisan_participants`/
  `arisan_payments`, migrasi `009_arisan.sql`. Peserta disimpan sebagai
  nama bebas (bukan user terdaftar) karena arisan sering melibatkan
  tetangga/teman di luar app. Checklist bayar per periode (default bulan
  berjalan), toggle lunas/belum.
- ✅ **Scan struk otomatis hemat biaya** — `POST /api/receipts/scan`, foto
  dibaca OCR lokal (Tesseract), lalu regex TOTAL/tanggal dicoba dulu. Kalau
  regex belum yakin, teks OCR dikirim ke LLM murah via provider aktif
  (default SumoPod `gpt-4o-mini`, Anthropic tetap alternatif). Hasil hanya
  prefill form; user tetap review & submit manual.
- ✅ **Laporan bulanan otomatis via email** — `api/jobs/monthlyReport.js`,
  cron OS, kirim via Mailketing.
- ✅ **Export CSV** — transaksi bulan berjalan, dari halaman Akun.
- ✅ **Export PDF** — generate **client-side** (jsPDF + jspdf-autotable,
  bukan backend, hindari dependency berat kayak puppeteer di VPS),
  **lazy-loaded** lewat dynamic import (baru diunduh saat tombol ditekan,
  dan dikecualikan dari precache service worker via `globIgnores` — tanpa
  ini precache naik dari ~620KB jadi ~1.25MB). Trade-off yang diketahui:
  jsPDF sendiri ~130KB gzip kalau dipakai.

## Fase 6 — Monetisasi Penuh
- ✅ **Integrasi payment gateway (Midtrans)** — buat transaksi, webhook
  tervalidasi signature, auto-extend masa aktif, auto-expire.
- ✅ **Halaman Akun**: ubah plan, invite anggota (family), **riwayat
  pembayaran** (`GET /api/payments/history`, card baru di Akun).
- ✅ **Keputusan harga vs kompetitor** — **diputuskan** (2026-07-11): tetap
  premium di harga sekarang (Rp29rb/bulan, Rp149rb/6bln, Rp249rb/tahun),
  bersaing lewat kedalaman fitur, bukan harga. Tidak ada perubahan kode.

---

## Bug yang ditemukan & diperbaiki sepanjang jalan

Pola berulang yang perlu diwaspadai kalau menambah kolom `DATE` baru di
tabel manapun ke depannya: `RETURNING *` / `SELECT` polos pada kolom
`DATE` di-serialize JSON dengan `toISOString()`, yang menggeser tanggal
mundur 1 hari untuk timezone di depan UTC (kasus VPS ini: WIB/+7). Fix-nya
selalu `to_char(kolom, 'YYYY-MM-DD') as kolom` di setiap query yang
mengembalikan kolom DATE ke client. Ditemukan ulang di `bills.js` (migrasi
007) setelah sebelumnya sempat diperbaiki di `transactions.js` — jadi ini
kelas bug yang gampang muncul lagi di endpoint baru, bukan sekali perbaiki
lalu selesai.

## Environment variable baru yang perlu diisi di VPS

Selain yang sudah ada (Midtrans, Mailketing), fase ini menambah:

```
VAPID_PUBLIC_KEY=...   # sudah diisi otomatis (self-generated), aman dipakai apa adanya
VAPID_PRIVATE_KEY=...  # sudah diisi otomatis (self-generated), JANGAN di-regenerate di VPS
                        # kalau sudah ada user yang subscribe (subscription lama jadi invalid)
VAPID_SUBJECT=mailto:admin@finepro.my.id
AI_PROVIDER=sumopod
SUMOPOD_API_KEY=isi-sumopod-api-key
SUMOPOD_BASE_URL=https://ai.sumopod.com/v1
SUMOPOD_MODEL=gpt-4o-mini
RECEIPT_PARSE_PROVIDER=sumopod

# Opsional: alternatif jika ingin pilih Anthropic dari Admin Console.
ANTHROPIC_API_KEY=isi-anthropic-api-key
ANTHROPIC_MODEL=claude-sonnet-4-5
```
