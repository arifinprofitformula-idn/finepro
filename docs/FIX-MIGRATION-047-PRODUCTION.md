# Fix Production Migration 047

Masalah:

- Auto-deploy sudah mencoba menjalankan `supabase/migrations/047_bill_payment_transaction_link.sql`.
- Migration gagal karena user deploy `keuangan_app` bukan owner tabel `bill_payment_statements`.
- Karena migration gagal, deploy abort dan marker deploy belum pindah ke commit terbaru.

## 1. Apply 047 Sebagai Owner/Superuser

Jalankan di VPS sebagai user yang boleh memakai PostgreSQL superuser, misalnya `ubuntu` dengan `sudo`:

```bash
cd /home/ubuntu/projects/finepro
sudo -u postgres psql -d keuangan -v ON_ERROR_STOP=1 -f supabase/migrations/047_bill_payment_transaction_link.sql
```

Catat migration setelah SQL sukses:

```bash
sudo -u postgres psql -d keuangan -v ON_ERROR_STOP=1 -c "INSERT INTO schema_migrations (filename) VALUES ('047_bill_payment_transaction_link.sql') ON CONFLICT DO NOTHING;"
```

Verifikasi:

```bash
sudo -u postgres psql -d keuangan -c "SELECT filename, applied_at FROM schema_migrations WHERE filename LIKE '047%';"
sudo -u postgres psql -d keuangan -c "\d bill_payment_statements"
```

## 2. Rerun Deploy

Setelah `047` tercatat, jalankan ulang deploy/webhook. Deploy seharusnya melewati `047`, build, sync file, lalu menulis `.deployed_commit`.

Verifikasi marker:

```bash
cd /home/ubuntu/projects/finepro
git rev-parse origin/main
cat /var/www/finepro/.deployed_commit
```

Kedua commit harus sama.

## 3. Perbaikan Jangka Panjang

Pilihan paling aman: gunakan user migration khusus pada `.env` deploy:

```env
DB_MIGRATION_USER=postgres
DB_MIGRATION_PASSWORD=isi_password_postgres_jika_login_tcp
```

`deploy.sh` akan memakai user tersebut hanya untuk migration. Jika tidak diisi, deploy fallback ke `DB_USER`/`keuangan_app`.

Alternatif jika ingin tetap memakai `keuangan_app` untuk migration, rapikan ownership semua object aplikasi:

```sql
ALTER TABLE bill_payment_statements OWNER TO keuangan_app;
ALTER TABLE bills OWNER TO keuangan_app;
ALTER TABLE transactions OWNER TO keuangan_app;
ALTER TABLE categories OWNER TO keuangan_app;
ALTER TABLE wallets OWNER TO keuangan_app;
ALTER TABLE budgets OWNER TO keuangan_app;
```

Sebelum mengubah ownership massal, audit dulu:

```sql
SELECT schemaname, tablename, tableowner
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tableowner, tablename;
```

Jangan catat row di `schema_migrations` sebelum SQL migration benar-benar sukses.
