# Panduan Deploy ke VPS Sendiri — Keuangan Keluarga PWA

Catatan: langkah-langkah ini dijalankan dari terminal SSH ke VPS Coach Arifin sendiri. Saya tidak bisa mengeksekusinya dari sini — ini panduan copy-paste yang dijalankan langsung di VPS.

---

## Langkah 0 — Deteksi Environment VPS

SSH masuk ke VPS, lalu jalankan:

```bash
cat /etc/os-release   # cek OS: Ubuntu, Debian, CentOS, AlmaLinux, dll.
which nginx apache2 httpd 2>/dev/null   # cek apakah web server sudah ada
sudo ss -tlnp | grep -E ':80|:443'      # cek port 80/443 sudah dipakai proses apa
```

Kalau hasilnya menunjukkan Nginx atau Apache sudah berjalan untuk website lain, lompat ke **Langkah 3B** (tambah server block baru, bukan install ulang).

---

## Langkah 1 — Siapkan "Domain" Gratis dari IP (karena belum ada domain)

PWA **wajib HTTPS** agar service worker & "Add to Home Screen" berfungsi. Tanpa domain asli, gunakan trik `nip.io` (layanan DNS gratis, tanpa daftar):

```
Kalau IP VPS Anda: 123.45.67.89
Maka "domain" Anda otomatis jadi: 123.45.67.89.nip.io
```

Tidak perlu setting apapun — `nip.io` otomatis me-resolve ke IP yang tertera di dalam namanya. Catat alamat ini, dipakai di langkah selanjutnya.

Begitu Coach Arifin punya domain asli nanti, tinggal arahkan A record ke IP VPS dan ganti `server_name` di konfigurasi Nginx — tidak perlu bongkar ulang.

---

## Langkah 2 — Install Nginx & Certbot (jika belum ada)

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
sudo systemctl enable nginx --now
```

**CentOS/AlmaLinux/Rocky:**
```bash
sudo dnf install -y nginx certbot python3-certbot-nginx
sudo systemctl enable nginx --now
sudo firewall-cmd --permanent --add-service=http --add-service=https
sudo firewall-cmd --reload
```

---

## Langkah 3A — Build & Upload Aplikasi

Project ini pakai Vite. Yang diupload ke VPS **bukan source code** (`src/`, `index.html` mentah, dst.), melainkan **hasil build** di folder `dist/` — sudah diminifikasi dan bundel siap pakai.

Dari komputer Coach Arifin (bukan dari VPS):
```bash
npm install
npm run build          # hasil ada di folder dist/
```

Kalau folder `/var/www/keuangan` belum ada, buat dulu di VPS:
```bash
sudo mkdir -p /var/www/keuangan
sudo chown -R $USER:$USER /var/www/keuangan
```

Lalu upload isi `dist/` (bukan foldernya, isinya saja):
```bash
scp -r dist/* root@123.45.67.89:/var/www/keuangan/
```

Source code (`src/`, `supabase/`, `docs/`, `.env`, `package.json`, dst.) **tidak perlu dan tidak boleh** ikut diupload ke folder web — itu bagian development, bukan bagian yang disajikan ke browser. Hanya isi `dist/` yang perlu ada di `/var/www/keuangan`.

---

## Langkah 3B — Pasang Konfigurasi Nginx

1. Salin file `docs/nginx-keuangan.conf` yang sudah disiapkan ke VPS:
```bash
scp docs/nginx-keuangan.conf root@123.45.67.89:/etc/nginx/sites-available/keuangan
```

2. Di VPS, edit baris `server_name` — ganti `GANTI_DENGAN_DOMAIN_ANDA` dengan `123.45.67.89.nip.io` (atau domain asli jika sudah ada):
```bash
sudo nano /etc/nginx/sites-available/keuangan
```

3. Aktifkan site:
```bash
sudo ln -s /etc/nginx/sites-available/keuangan /etc/nginx/sites-enabled/
sudo nginx -t          # cek konfigurasi valid
sudo systemctl reload nginx
```

> Kalau VPS pakai CentOS/AlmaLinux (tidak ada folder `sites-available`), taruh file langsung di `/etc/nginx/conf.d/keuangan.conf` dan lewati langkah symlink.

---

## Langkah 4 — Pasang SSL (HTTPS) Gratis via Let's Encrypt

```bash
sudo certbot --nginx -d 123.45.67.89.nip.io
```

Ikuti prompt (isi email, setuju ToS). Certbot otomatis mengubah konfigurasi Nginx untuk redirect HTTP → HTTPS dan pasang sertifikat. Perpanjangan otomatis sudah aktif secara default (cek dengan `sudo certbot renew --dry-run`).

---

## Langkah 5 — Update Supabase agar Sinkron dengan Domain Baru

Di Supabase Dashboard → **Authentication → URL Configuration**:
- **Site URL**: isi dengan `https://123.45.67.89.nip.io`
- **Redirect URLs**: tambahkan `https://123.45.67.89.nip.io/*`

Ini penting agar email konfirmasi pendaftaran mengarah ke domain yang benar, bukan `localhost`.

---

## Langkah 6 — Uji Coba

1. Buka `https://123.45.67.89.nip.io` di HP.
2. Pastikan ada ikon gembok (SSL valid) — kalau ada peringatan "Not Secure", ulangi Langkah 4.
3. Coba "Add to Home Screen" — harus muncul opsinya (tidak muncul = ada masalah di manifest/service worker/HTTPS).
4. Daftar akun baru, tambah transaksi, logout-login untuk pastikan data tersimpan di Supabase.

---

## Perbandingan Singkat: VPS Sendiri vs Vercel

| Aspek | VPS Sendiri | Vercel (gratis) |
|---|---|---|
| Kontrol penuh server | Ya | Terbatas |
| Setup awal | Lebih teknis (Nginx, SSL manual) | Drag & drop, otomatis |
| Biaya | Sudah dibayar (VPS Coach Arifin) | Gratis sampai skala tertentu |
| Auto-scaling saat trafik naik | Manual, perlu monitoring sendiri | Otomatis |
| Cocok untuk | Coach Arifin yang mau kendali penuh & sudah familiar server | Validasi cepat tanpa mikir infrastruktur |

Karena Coach Arifin sudah punya VPS, ini pilihan valid — terutama kalau nanti mau menambahkan layanan lain (API custom, worker cron untuk cek langganan expired, dll.) yang lebih leluasa dikontrol di VPS dibanding platform serverless.

---

## Maintenance yang Perlu Diingat (VPS = tanggung jawab sendiri)

Berbeda dari Vercel yang mengurus infrastruktur otomatis, di VPS Coach Arifin perlu:
- Pantau perpanjangan SSL (biasanya otomatis, tapi cek berkala)
- Update Nginx & OS secara berkala (`apt update && apt upgrade`)
- Backup konfigurasi Nginx bila server di-reset
- Kalau nanti tambah domain asli, ulangi Langkah 4 dengan domain baru
