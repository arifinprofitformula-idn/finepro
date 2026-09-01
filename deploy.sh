#!/bin/bash
# /home/ubuntu/projects/finepro/deploy.sh
# Dijalankan oleh webhook GitHub — auto deploy: pull → migrate → build → copy
set -euo pipefail

PROJECT_DIR="/home/ubuntu/projects/finepro"
DEPLOY_DIR="/var/www/finepro"
LOG_FILE="/tmp/finepro-deploy.log"
LOCK_FILE="/tmp/finepro-deploy.lock"

exec >> "$LOG_FILE" 2>&1

# Concurrency guard — jangan biarkan dua deploy tumpang tindih
if [ -f "$LOCK_FILE" ]; then
  LOCK_PID=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
  if [ -n "$LOCK_PID" ] && kill -0 "$LOCK_PID" 2>/dev/null; then
    echo "=== $(date) Deploy skipped: another deploy is running (pid $LOCK_PID) ==="
    exit 0
  fi
  echo "=== $(date) Stale lock found, clearing ==="
  rm -f "$LOCK_FILE"
fi
echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

echo "=== $(date) Deploy started ==="

cd "$PROJECT_DIR"

# Load env vars (DB_PASSWORD dll) — .env punya value tanpa quote (spasi),
# jadi tidak aman di-`source` langsung (bash akan coba eksekusi token setelah
# spasi sebagai command terpisah). Baca baris per baris, export tanpa eval shell.
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    ''|'#'*) continue ;;
  esac
  key="${line%%=*}"
  val="${line#*=}"
  key="$(echo "$key" | xargs)"
  case "$key" in
    ''|*[!A-Za-z0-9_]*) continue ;;
  esac
  export "$key=$val"
done < "$PROJECT_DIR/.env"

git fetch origin main
NEW_COMMIT=$(git rev-parse origin/main)
OLD_COMMIT=$(git rev-parse HEAD)

if [ "$OLD_COMMIT" = "$NEW_COMMIT" ] && [ -f "$DEPLOY_DIR/.deployed_commit" ] \
   && [ "$(cat "$DEPLOY_DIR/.deployed_commit")" = "$NEW_COMMIT" ]; then
  echo "=== $(date) Deploy skipped: already at $NEW_COMMIT ==="
  exit 0
fi

git reset --hard origin/main

# Migrasi database — hanya file yang belum tercatat di schema_migrations
DB_HOST_VALUE="${DB_HOST:-127.0.0.1}"
DB_NAME_VALUE="${DB_NAME:-keuangan}"
DB_APP_USER="${DB_USER:-keuangan_app}"
DB_MIGRATION_USER_VALUE="${DB_MIGRATION_USER:-$DB_APP_USER}"
DB_MIGRATION_PASSWORD_VALUE="${DB_MIGRATION_PASSWORD:-$DB_PASSWORD}"

PGPASSWORD="${DB_MIGRATION_PASSWORD_VALUE}" psql -h "$DB_HOST_VALUE" -U "$DB_MIGRATION_USER_VALUE" -d "$DB_NAME_VALUE" -v ON_ERROR_STOP=1 -c \
  "CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());"

for f in supabase/migrations/*.sql; do
  fname=$(basename "$f")
  ALREADY=$(PGPASSWORD="${DB_MIGRATION_PASSWORD_VALUE}" psql -h "$DB_HOST_VALUE" -U "$DB_MIGRATION_USER_VALUE" -d "$DB_NAME_VALUE" -tAc \
    "SELECT 1 FROM schema_migrations WHERE filename = '${fname}'")
  if [ "$ALREADY" = "1" ]; then
    continue
  fi
  echo "Running migration: $f"
  if PGPASSWORD="${DB_MIGRATION_PASSWORD_VALUE}" psql -h "$DB_HOST_VALUE" -U "$DB_MIGRATION_USER_VALUE" -d "$DB_NAME_VALUE" -v ON_ERROR_STOP=1 -f "$f"; then
    PGPASSWORD="${DB_MIGRATION_PASSWORD_VALUE}" psql -h "$DB_HOST_VALUE" -U "$DB_MIGRATION_USER_VALUE" -d "$DB_NAME_VALUE" -c \
      "INSERT INTO schema_migrations (filename) VALUES ('${fname}') ON CONFLICT DO NOTHING;"
  else
    echo "=== $(date) Deploy ABORTED: migration $fname failed ==="
    exit 1
  fi
done

# Install dependencies
npm install --production=false
cd api && npm install --production=false && cd ..

# Build frontend
npm run build

# Deploy — panggil wrapper root tunggal (sudoers tidak bisa aman match
# wildcard shell-expanded seperti `rm -rf DIR/*`; wrapper menghindari itu).
# Marker .deployed_commit ditulis DI DALAM wrapper (oleh root) karena
# /var/www/finepro owned caddy:caddy — ubuntu tidak punya izin tulis di sana.
sudo -n /usr/local/sbin/finepro-deploy-sync.sh "$NEW_COMMIT"

echo "=== $(date) Deploy OK ($NEW_COMMIT) ==="
