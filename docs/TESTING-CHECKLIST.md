# Checklist Uji Manual — Sebelum Tiap Rilis

Jalankan urutan ini di environment staging/lokal sebelum deploy ke production.
Semua langkah harus **lolos** sebelum rilis. Kalau ada yang gagal, catat di
issue tracker sebelum lanjut deploy.

## 1. Signup & Login

- [ ] Signup dengan email baru → berhasil, otomatis masuk ke onboarding pilih persona
- [ ] Signup dengan email yang sudah terdaftar → ditolak dengan pesan jelas (409)
- [ ] Signup dengan password < 6 karakter → ditolak (400)
- [ ] Login dengan email/password benar → berhasil, masuk ke dashboard (atau onboarding kalau belum punya household)
- [ ] Login dengan password salah → ditolak, pesan generik "Email atau password salah" (jangan bocorkan mana yang salah — email atau password)
- [ ] Login dengan email yang tidak terdaftar → pesan sama seperti password salah (jangan bocorkan email terdaftar/tidak)
- [ ] Buka DevTools → Network saat login sukses → pastikan `password` tidak pernah muncul di response body manapun (hanya di request)

## 2. Tambah Transaksi

- [ ] Tambah transaksi pengeluaran → muncul di dashboard, KPI pengeluaran & saldo ter-update
- [ ] Tambah transaksi pemasukan → KPI pemasukan & saldo ter-update
- [ ] Tanggal transaksi yang ditampilkan di dashboard **sama persis** dengan tanggal yang diinput (cek tidak ada pergeseran timezone)
- [ ] Hapus transaksi → hilang dari list, KPI ter-update
- [ ] Export CSV bulan berjalan → file terunduh, isi tanggal/nominal/kategori sesuai data asli

## 3. Undang Anggota Household (persona family)

- [ ] Sebagai owner, undang email anggota baru → undangan tersimpan
- [ ] Login/daftar dengan email yang diundang → undangan pending muncul di layar onboarding DAN halaman Akun
- [ ] Terima undangan → berhasil gabung ke household owner, bisa lihat transaksi bersama
- [ ] User yang sudah punya household sendiri mencoba terima undangan lain → ditolak dengan pesan jelas (409), tidak merusak data household yang sudah ada
- [ ] Transaksi yang dicatat anggota (bukan owner) → muncul label "Dicatat oleh [nama anggota]" di dashboard

## 4. Upgrade Plan (Pembayaran)

- [ ] Sebagai owner, pilih salah satu plan → redirect ke halaman pembayaran Midtrans (sandbox)
- [ ] Selesaikan pembayaran sandbox (kartu test Midtrans) → redirect balik ke app, status "Memeriksa..." muncul lalu berubah jadi "Pembayaran berhasil"
- [ ] Setelah pembayaran sukses → `planLabel` di header & halaman Akun ter-update ke plan baru
- [ ] Batalkan pembayaran di halaman Midtrans → redirect balik, status menunjukkan gagal/dibatalkan, plan **tidak** berubah
- [ ] Sebagai anggota (bukan owner) → tombol upgrade plan tidak tersedia / ditolak backend (403) kalau dicoba langsung lewat API

## 5. Langganan Expired

- [ ] Set `current_period_end` household test ke tanggal lampau langsung di database (`UPDATE subscriptions SET current_period_end = CURRENT_DATE - interval '1 day' WHERE household_id = '...'`)
- [ ] Buka/refresh app → status otomatis berubah jadi "expired" (cek `GET /api/households`)
- [ ] Banner "Langganan telah berakhir" muncul di dashboard
- [ ] Data transaksi lama **tetap bisa dilihat** (tidak hilang/terkunci)
- [ ] Tombol tambah transaksi (FAB & bottom nav) nonaktif
- [ ] Upgrade plan dari halaman Akun → berhasil membuat status aktif kembali

## 6. 🔒 Uji Akses Lintas Household (WAJIB — tidak ada RLS di setup ini)

Ini pengujian paling penting di checklist ini. Siapkan dua akun berbeda
(User A dan User B) yang **masing-masing punya household sendiri** dan
saling tidak berhubungan (bukan owner/member di household yang sama).

- [ ] Login sebagai User A, catat `household_id`-nya (lihat response `GET /api/households`) dan simpan token JWT-nya
- [ ] Login sebagai User B, catat token JWT-nya
- [ ] Pakai token User B, coba `GET /api/transactions` → pastikan **hanya** transaksi household User B yang muncul, bukan household User A
- [ ] Pakai token User B, coba hapus transaksi milik household User A langsung lewat `DELETE /api/transactions/:id` (pakai ID transaksi User A) → harus gagal (404, bukan 200)
- [ ] Pakai token User B, coba `GET /api/budgets`, `GET /api/categories` → hanya data household User B yang muncul
- [ ] Pakai token User B, coba `PATCH /api/households/me` dengan payload apa pun → hanya household User B yang berubah, household User A tidak tersentuh
- [ ] Pakai token User B, coba `GET /api/payments/status/:orderId` dengan `orderId` milik household User A → harus gagal (404)
- [ ] Pakai token yang **sudah di-tamper** (ubah 1 karakter di signature JWT) → semua endpoint terautentikasi harus menolak dengan 401
- [ ] Panggil endpoint mana pun tanpa header `Authorization` sama sekali → 401
- [ ] (Kalau memungkinkan) coba login berkali-kali dengan password salah dalam waktu singkat → pastikan ada pembatasan/penundaan setelah rate limiting terpasang

Contoh perintah cepat pakai curl untuk poin di atas:

```bash
# Ambil token dua user
TOKEN_A=$(curl -s -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"email":"usera@test.local","password":"..."}' | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).token))")
TOKEN_B=$(curl -s -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"email":"userb@test.local","password":"..."}' | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).token))")

# User B coba lihat transaksi -- harus cuma punya B, bukan A
curl -s http://localhost:3001/api/transactions -H "Authorization: Bearer $TOKEN_B"

# User B coba hapus transaksi milik A -- harus 404
curl -s -w "\nHTTP:%{http_code}\n" -X DELETE http://localhost:3001/api/transactions/<ID_TRANSAKSI_A> -H "Authorization: Bearer $TOKEN_B"
```

## 7. PWA / Installable

- [ ] Buka app di Chrome (desktop) → DevTools → tab **Lighthouse** → centang **Progressive Web App** → **Analyze page load**
- [ ] Semua audit PWA harus lolos: manifest valid, service worker terdaftar, ikon 192/512 tersedia, installable
- [ ] Di Chrome desktop, ada ikon "Install" di address bar → klik → app terbuka sebagai window standalone
- [ ] Di HP (Android/iOS Safari), "Tambahkan ke Layar Utama" → ikon app muncul dengan benar, buka sebagai fullscreen tanpa address bar browser
- [ ] Matikan koneksi internet setelah app pernah dibuka sekali → buka lagi → shell app tetap termuat (walau data tidak update, karena `NetworkOnly`/API tidak bisa cache data dinamis)

## 8. Regresi Umum

- [ ] Household bertipe `family`, `student`, `individual` masing-masing tetap tampil kategori & fitur yang sesuai (reminder tanggal uang bulanan hanya utk student, dst.)
- [ ] Tidak ada error di Console browser saat navigasi normal antar halaman
- [ ] Tidak ada error 500 di log `api/` (`pm2 logs` / journalctl) selama sesi uji berlangsung
