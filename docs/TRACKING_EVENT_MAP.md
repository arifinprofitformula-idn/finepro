# Tracking Event Map

Sumber kebenaran tunggal (typed) ada di
[`api/lib/tracking/eventRegistry.js`](../api/lib/tracking/eventRegistry.js)
(`DEFAULT_EVENT_MAPPING`). Tabel di bawah adalah dokumentasi turunannya —
kalau ada perbedaan, kode yang menang. Admin dapat override enabled/channel/
provider-event-name lewat Admin Console > Tracking > Event Mapping (disimpan
di `app_settings.tracking.event_mapping_json`).

| Internal Event | Trigger | Meta Event | Meta Channel | GA4 Event | GA4 Channel | Allowed Parameters | Consent Category | Business Owner |
|---|---|---|---|---|---|---|---|---|
| `page_view` | Perpindahan halaman (SPA) setelah consent | `PageView` | browser | `page_view` | browser | `page_path`, `page_location`, `source`, `utm_*` | analytics atau marketing | Growth |
| `view_landing_page` | Landing page publik dibuka | `ViewContent` | browser | `view_landing_page` | browser | `content_name`, `content_category`, `page_path`, `page_location`, `source` | marketing | Growth |
| `primary_cta_clicked` | Tombol CTA utama diklik | `CTA_Click` (custom) | browser | `select_content` | browser | `content_name`, `content_category`, `page_path`, `source`, `method` | marketing | Growth |
| `registration_started` | Form registrasi pertama kali disubmit | `Lead` | browser | `generate_lead` | browser | `method`, `source`, `page_path` | marketing | Growth |
| `registration_completed` | Akun berhasil dibuat di database | `CompleteRegistration` | browser + server (event_id sama, dedup) | `sign_up` | server | `method`, `trial_days`, `source`, `utm_*` | marketing | Growth |
| `trial_started` | Trial aktif di database (bersamaan dengan registrasi di FinePro) | `StartTrial` | browser + server | `start_trial` | server | `trial_days`, `plan_id`, `source` | marketing | Growth |
| `first_transaction_created` | Transaksi pertama household tersimpan (nominal TIDAK dikirim) | `FirstTransaction` (custom) | server | `first_transaction` | server | `source` | marketing | Product |
| `receipt_uploaded` | Upload struk diterima sistem (isi struk TIDAK dikirim) | `ReceiptUploaded` (custom) | server | `receipt_uploaded` | server | `source` | marketing | Product |
| `budget_created` | Budget kategori baru tersimpan (nilai budget TIDAK dikirim) | `BudgetCreated` (custom) | server | `budget_created` | server | `source` | marketing | Product |
| `subscription_purchased` | Pembayaran langganan FinePro dikonfirmasi sukses | `Purchase` | browser + server | `purchase` | server | `currency`, `value` (harga paket FinePro), `plan_id`, `transaction_id`, `method`, `utm_*` | marketing | Revenue |

## Business Boundary — Titik Integrasi Server

| Event | File | Fungsi |
|---|---|---|
| `registration_completed`, `trial_started` | `api/routes/auth.js` | `POST /register`, setelah `INSERT INTO users` sukses & response 201 terkirim |
| `first_transaction_created` | `api/routes/transactions.js` | `POST /`, setelah insert, hanya kalau household belum punya transaksi sebelumnya |
| `receipt_uploaded` | `api/routes/receipts.js` | `POST /scan`, setelah OCR/parse sukses & response terkirim |
| `budget_created` | `api/routes/budgets.js` | `PUT /`, hanya kalau kategori budget belum ada sebelumnya |
| `subscription_purchased` | `api/routes/payments.js` | `applyPaymentStatus()`, dipanggil dari webhook Midtrans/Xendit maupun approval manual admin, setelah status `paid` ter-commit |

## Deduplication event_id

- **Registrasi/Trial**: `event_id` di-generate di server (`crypto.randomUUID()`)
  saat `POST /register`, dikembalikan ke browser lewat
  `response.trackingEventIds`, lalu dipakai browser (`AuthPage.jsx`) untuk
  memanggil `fbq('track', ..., { eventID })` dengan ID yang sama persis.
- **Subscription purchased**: `event_id` diturunkan **deterministik** dari
  `order_id` lewat `deriveEventId()` (`api/lib/tracking/idempotency.js`, UUID
  v5) — karena webhook pembayaran berjalan async tanpa konteks browser,
  browser dan server menghasilkan ID yang sama tanpa perlu round-trip
  tambahan. Deduplikasi server-side sesungguhnya dijamin oleh unique index
  `(provider, channel, event_id)` di `tracking_event_deliveries`.

## Aturan Double Counting

- **GA4**: satu event hanya boleh browser **atau** server, tidak pernah
  keduanya. Skema di `resolveEventMapping()` (`eventRegistry.js`) hanya
  menerima channel `browser`/`server`/`none` untuk GA4 — nilai
  `browser_and_server` ditolak di level tipe maupun validasi API
  (`PATCH /api/admin/tracking/event-mapping`).
- **Meta**: boleh browser + server sekaligus karena Meta CAPI mendukung
  dedup resmi lewat `event_id` yang sama di kedua channel.
