# Checklist Sebelum Rilis Publik

Pastikan **semua** poin di sini selesai sebelum mengumumkan app ke publik.
Ini bukan checklist fitur — murni kesiapan operasional & keamanan produksi.

## 1. Secrets & Environment

- [ ] `JWT_SECRET` di `.env` VPS diisi string acak panjang (minimal 32 karakter),
      **bukan** nilai placeholder (`isi-jwt-secret-lokal` dsb). Generate dengan:
      `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- [ ] `GITHUB_WEBHOOK_SECRET` di `.env` VPS diisi string acak, bukan fallback
      default di kode (`api/routes/webhook.js`). Cocokkan dengan secret yang
      didaftarkan di GitHub repo settings > Webhooks.
- [ ] `DB_PASSWORD` bukan nilai default/lemah
- [ ] `MIDTRANS_SERVER_KEY` / `MIDTRANS_CLIENT_KEY` sudah **live key** (bukan
      sandbox `SB-Mid-...`), dan `MIDTRANS_IS_PRODUCTION=true`
- [ ] `MAILKETING_API_TOKEN` / `MAILKETING_FROM_EMAIL` valid dan email pengirim
      sudah terverifikasi di dashboard Mailketing
- [ ] `APP_BASE_URL` diisi domain publik asli (dipakai untuk redirect callback Midtrans)
- [ ] Sekali lagi pastikan `.env` **tidak** ter-commit ke git (`git log --all -- .env` kosong)

## 2. Domain & HTTPS

- [ ] Domain asli sudah diarahkan (A record) ke IP VPS — bukan skema `nip.io` sementara
- [ ] Certbot / Let's Encrypt sudah issue sertifikat untuk domain asli, HTTPS aktif
- [ ] Redirect otomatis HTTP → HTTPS di Nginx
- [ ] `nginx-keuangan.conf` — `server_name` sudah diisi domain asli, bukan placeholder
- [ ] **Verifikasi**: route `/uploads/*` (foto profil) sudah di-proxy Nginx ke backend Express (sama seperti `/api/*`) — kalau belum, foto profil akan 404 di domain publik
- [ ] Cek header keamanan dasar aktif di Nginx: `X-Content-Type-Options: nosniff`, `X-Frame-Options`, HSTS

## 3. Backend sebagai Service (bukan proses manual)

- [ ] Backend Express (`api/`) jalan sebagai **systemd service**, bukan `node server.js` manual di terminal/`nohup`
- [ ] Service auto-restart kalau crash (`Restart=on-failure` di unit file systemd)
- [ ] Service auto-start saat VPS reboot (`systemctl enable`)
- [ ] Job `api/jobs/monthlyReport.js` terpasang sebagai **cron OS** (lihat contoh crontab di file itu sendiri), bukan dijalankan manual
- [ ] Verifikasi log service bisa diakses (`journalctl -u <nama-service> -f`)

Contoh unit file systemd minimal (`/etc/systemd/system/keuangan-api.service`):

```ini
[Unit]
Description=Keuangan Keluarga API
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/keuangan-api
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5
EnvironmentFile=/var/www/keuangan-api/../.env

[Install]
WantedBy=multi-user.target
```

## 4. Database

- [ ] Koneksi backend ke Postgres pakai role aplikasi terbatas (`keuangan_app`), **bukan** `postgres` superuser — sudah dikonfirmasi lewat audit, cukup jaga jangan berubah
- [ ] **Backup terjadwal** — `pg_dump` harian minimal, disimpan di luar VPS yang sama (mis. object storage / VPS lain). Contoh cron:
      ```
      0 3 * * * pg_dump -U keuangan_app keuangan | gzip > /backups/keuangan-$(date +\%Y\%m\%d).sql.gz
      ```
- [ ] Retention backup jelas (mis. simpan 30 hari terakhir, hapus yang lebih lama)
- [ ] **Sudah pernah dites** proses restore dari backup (bukan cuma asumsi backup-nya valid)
- [ ] Database production baru dibuat dari baseline final `supabase/schema-pg.sql`
- [ ] Untuk database lama, migration baru di `supabase/migrations/*.sql` sudah dijalankan berurutan sesuai versi terakhir yang pernah diterapkan

## 5. Payment Gateway (Production)

- [ ] Akun Midtrans sudah verified/production-approved (bukan sandbox)
- [ ] Webhook URL notifikasi Midtrans di dashboard sudah diarahkan ke `https://domain-asli/api/payments/webhook`
- [ ] Sudah dites 1x transaksi nominal kecil sungguhan end-to-end di production sebelum buka publik
- [ ] Alur refund/pembatalan manual sudah dipahami (kalau ada kompilasi/dispute)

## 6. Monitoring & Error Logging Dasar

- [ ] Error di backend (500, exception tak tertangani) tercatat di log yang bisa diperiksa (minimal `journalctl`, idealnya file log terpisah)
- [ ] Ada cara cepat cek "API masih hidup" (`GET /api/health` sudah ada — cek dari luar VPS, bukan cuma `127.0.0.1`)
- [ ] Disk space VPS dipantau (upload avatar & backup DB bisa mengisi disk lama-lama)
- [ ] (Opsional tapi disarankan) Uptime monitor eksternal (mis. UptimeRobot gratis) ping `/api/health` tiap beberapa menit, kirim notifikasi kalau down

## 7. Keamanan (Referensi dari Audit)

Item ini merujuk ke laporan audit keamanan — pastikan semua **KRITIS** dan
**SEDANG** sudah diperbaiki sebelum rilis:

- [ ] `JWT_SECRET` acak panjang (lihat poin 1)
- [ ] `GITHUB_WEBHOOK_SECRET` acak panjang (lihat poin 1)
- [ ] Validasi ekstensi/tipe file upload avatar diperkuat (bukan trust nama file & Content-Type dari client)
- [ ] Rate limiting terpasang di `/api/auth/login` dan `/api/auth/register`
- [ ] `POST /api/households` sudah dicegah dibuat berkali-kali oleh user yang sama
- [ ] Validasi format email di endpoint undangan

## 8. Uji Terakhir

- [ ] `docs/TESTING-CHECKLIST.md` sudah dijalankan penuh di environment production/staging, termasuk bagian **uji akses lintas household**
- [ ] Lighthouse PWA audit lolos di domain publik asli (HTTPS aktif memengaruhi hasil beberapa audit)
