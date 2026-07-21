# Tracking Setup — Meta Pixel/CAPI & GA4/Measurement Protocol

## 1. Arsitektur

FinePro adalah SPA Vite + React (tanpa react-router, routing state-based —
lihat `src/App.jsx`) dengan backend Express.js + PostgreSQL (raw SQL, tanpa
ORM). Sistem tracking mengikuti pola yang sama:

- **Settings**: satu baris singleton di tabel `app_settings` (key = `tracking`),
  sama seperti integrasi lain (Mailketing, Midtrans, dst — lihat
  `api/services/appSettings.js`). Secret (Access Token Meta, API Secret GA4,
  Test Event Code) dienkripsi AES-256-GCM sebelum disimpan
  (`api/lib/tracking/encryption.js`).
- **Delivery log**: tabel `tracking_event_deliveries` — audit server-side,
  bukan log semua aktivitas browsing. Unique index `(provider, channel,
  event_id)` mencegah pengiriman server berulang.
- **Attribution**: tabel `acquisition_attribution` — first/last-touch UTM,
  first-party, ditautkan ke `user_id` setelah registrasi.
- **Browser**: `src/components/tracking/TrackingProvider.jsx` mengambil
  public settings dari `GET /api/tracking/public-settings` (subset aman —
  tidak pernah berisi access token/api secret), lalu memuat Meta Pixel/GA4
  hanya setelah consent diberikan.
- **Server**: `api/lib/tracking/trackingService.js` (`trackBusinessEvent`)
  adalah facade tunggal dipanggil dari route bisnis (registrasi, transaksi
  pertama, upload struk, budget, pembayaran) **setelah** commit database.
  Kegagalan tracking tidak pernah melempar error ke business flow.

## 2. Generate `TRACKING_ENCRYPTION_KEY`

Wajib diisi di `.env` sebelum server bisa membaca/menulis secret tracking.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Simpan hasilnya di `TRACKING_ENCRYPTION_KEY` (di `.env`, bukan dikomit ke
Git). Kalau key ini hilang/berubah, semua secret tracking yang sudah
tersimpan tidak bisa didekripsi lagi — harus dimasukkan ulang lewat Admin
Console.

## 3. Meta Pixel / Dataset ID

1. Buka [Meta Events Manager](https://business.facebook.com/events_manager2).
2. Pilih atau buat Pixel/Dataset FinePro.
3. Salin **Pixel ID** (angka) dari halaman Settings pixel tersebut.
4. Masukkan ke Admin Console > Tracking > Meta Ads > "Meta Pixel / Dataset ID".

## 4. Membuat Meta Conversions API Access Token

1. Di Events Manager, buka pixel yang sama > tab **Settings**.
2. Scroll ke bagian **Conversions API** > **Generate access token**.
3. Salin token (hanya ditampilkan sekali) dan masukkan ke Admin Console >
   Tracking > Meta Ads > "Meta Access Token", lalu **Save Configuration**.
4. Token tidak pernah dikirim balik ke browser — API hanya mengembalikan
   status `configured: true/false`.

## 5. Memperoleh Test Event Code

Di Events Manager > **Test Events** tab, salin kode yang tampil (mis.
`TEST12345`) dan masukkan ke field "Meta Test Event Code". Test Event Code
membuat event test langsung terlihat di tab Test Events tanpa memengaruhi
data produksi.

## 6. Mendapatkan GA4 Measurement ID

1. Buka [Google Analytics](https://analytics.google.com) > Admin > Data
   Streams > pilih stream web FinePro.
2. Salin **Measurement ID** (format `G-XXXXXXXXXX`).
3. Masukkan ke Admin Console > Tracking > Google Analytics.

## 7. Membuat Measurement Protocol API Secret

1. Di halaman Data Stream yang sama > **Measurement Protocol API secrets**.
2. Klik **Create** > beri nama (mis. "FinePro server") > salin Secret Value.
3. Masukkan ke field "GA4 Measurement Protocol API Secret", lalu simpan.

## 8. Mengisi Halaman Admin

`/admin` > login admin > tab **Tracking**, berisi 6 sub-tab:

- **Overview** — status ringkas semua integrasi + tombol Configure.
- **Meta Ads** — Pixel ID, Access Token, Test Event Code, toggle
  browser/server, exclude admin routes/users, debug logging.
- **Google Analytics** — Measurement ID, API Secret, region endpoint, toggle
  browser/server.
- **Consent** — banner on/off, default consent analytics/marketing, versi
  consent, judul/deskripsi banner, URL kebijakan privasi/cookie.
- **Event Mapping** — aktifkan/nonaktifkan tiap internal event, pilih channel
  Meta (browser/server/keduanya) dan GA4 (browser **atau** server, tidak
  pernah keduanya — mencegah double counting).
- **Delivery Logs** — log pengiriman server-side, filter provider/status/event,
  retensi 30 hari.

Server tracking (CAPI/Measurement Protocol) tidak bisa diaktifkan sebelum ID
+ secret terkait terisi — validasi ada di `api/lib/tracking/settingsRepository.js`.

## 9. Menguji Meta Test Events

1. Simpan Pixel ID + Access Token, lalu isi Test Event Code (opsional tapi
   disarankan).
2. Klik **Test Meta CAPI** — mengirim custom event `FineProTrackingTest`.
3. Buka Events Manager > Test Events, event akan muncul dalam beberapa detik.
4. Klik **Clear Test Event Code** setelah selesai supaya event produksi tidak
   ikut ter-tag sebagai test.

## 10. Menguji GA4 Validation

Klik **Validate GA4 Payload** — memanggil endpoint debug Google
(`/debug/mp/collect`, `validation_behavior: ENFORCE_RECOMMENDATIONS`).
Endpoint ini **hanya memvalidasi struktur payload** — event validasi TIDAK
masuk ke laporan GA4, dan tidak membuktikan API Secret benar (endpoint debug
menerima secret apa pun). Gunakan Realtime Test (poin berikutnya) untuk
verifikasi API Secret yang sesungguhnya.

## 11. Memeriksa GA4 Realtime dan DebugView

1. Klik **Send Realtime Test** — mengirim event `finepro_tracking_test`
   dengan `debug_mode: 1`.
2. Buka GA4 > Reports > Realtime, atau Admin > DebugView.
3. Event akan muncul dalam 1-2 menit kalau API Secret benar.

## 12. Menguji Consent

1. Buka halaman publik FinePro di mode incognito (belum pernah memilih
   consent).
2. Banner cookie harus muncul di bawah, dengan tombol **Terima Semua**,
   **Tolak Non-Esensial**, dan **Atur Preferensi**.
3. Setelah memilih, Meta Pixel/GA4 hanya dimuat sesuai kategori yang
   di-granted (cek Network tab: `fbevents.js` / `gtag/js` hanya muncul kalau
   consent terkait granted).
4. Buka lagi lewat tombol **Pengaturan Privasi** di footer — pilihan
   tersimpan harus muncul kembali.
5. Naikkan `consent_version` di Admin Console — banner harus muncul lagi
   untuk pengguna yang sudah pernah memilih di versi lama.

## 13. Event Map

Lihat [`TRACKING_EVENT_MAP.md`](./TRACKING_EVENT_MAP.md).

## 14. Data yang TIDAK PERNAH Dikirim ke Provider

- Saldo, nominal pemasukan/pengeluaran, nilai budget.
- Isi struk, nama merchant, deskripsi/catatan transaksi pengguna.
- Nomor rekening, data kartu, password, token autentikasi.
- Email/nomor telepon mentah (hanya SHA-256 hash yang dikirim ke Meta, dan
  hanya untuk event yang memang butuh advanced matching).
- Access Token Meta / API Secret GA4 (tidak pernah ke browser, tidak pernah
  ke log/delivery log/audit log).
- Payload lengkap request provider di delivery log (hanya metadata status).

Allowlist parameter per event ada di `api/lib/tracking/eventRegistry.js`
(`DEFAULT_EVENT_MAPPING[...].allowedParams`) — parameter di luar daftar
dibuang otomatis oleh `filterParameters()`, bukan diteruskan.

## 15. Troubleshooting

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| "Event belum terkirim karena Access Token Meta belum dikonfigurasi" | Server tracking aktif tapi token kosong/dihapus | Isi ulang Access Token di tab Meta Ads |
| Test Meta CAPI gagal dengan HTTP 401/403 | Token salah/expired atau Pixel ID tidak sesuai token | Generate token baru di Events Manager |
| GA4 Realtime Test tidak muncul di DebugView | API Secret salah, atau Measurement ID beda stream | Cocokkan Measurement ID & buat ulang API Secret |
| Meta Pixel/GA4 tidak termuat di browser | Consent belum granted, atau localhost tanpa debug mode | Terima consent terkait; aktifkan `tracking_debug_enabled` untuk test di localhost |
| Event GA4 browser+server dianggap dobel | Admin mengaktifkan GA4 browser DAN server untuk event yang sama | Pilih salah satu channel saja di tab Event Mapping |
| "Terlalu banyak percobaan test" | Rate limit test endpoint (5x/10 menit per admin) | Tunggu beberapa menit |

## 16. Production Checklist

- [ ] `TRACKING_ENCRYPTION_KEY` terisi di `.env` production (32 byte random, base64).
- [ ] Migration `040_tracking_system.sql` sudah dijalankan (`deploy.sh` menjalankan semua file `supabase/migrations/*.sql` otomatis).
- [ ] Meta Pixel ID + Access Token terisi, `meta_browser_enabled`/`meta_server_enabled` aktif sesuai kebutuhan.
- [ ] GA4 Measurement ID + API Secret terisi, browser/server sesuai kebutuhan.
- [ ] Test Meta CAPI & Send GA4 Realtime Test sukses.
- [ ] Test Event Code Meta dikosongkan lagi setelah testing (`Clear Test Event Code`).
- [ ] `tracking_debug_enabled` **dimatikan** di production.
- [ ] Consent banner aktif, default `denied` untuk analytics & marketing.
- [ ] `privacy_policy_url` mengarah ke halaman privacy policy yang sudah diperbarui (lihat `src/pages/PrivacyPolicyPage.jsx` bagian Cookie).
- [ ] Delivery Logs menunjukkan status `success` setelah pengujian end-to-end (registrasi/purchase).
