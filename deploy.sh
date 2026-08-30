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
PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U keuangan_app -d keuangan -v ON_ERROR_STOP=1 -c \
  "CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());"

for f in supabase/migrations/*.sql; do
  fname=$(basename "$f")
  ALREADY=$(PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U keuangan_app -d keuangan -tAc \
    "SELECT 1 FROM schema_migrations WHERE filename = '${fname}'")
  if [ "$ALREADY" = "1" ]; then
    continue
  fi
  echo "Running migration: $f"
  if PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U keuangan_app -d keuangan -v ON_ERROR_STOP=1 -f "$f"; then
    PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U keuangan_app -d keuangan -c \
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

# Deploy
sudo -n rm -rf "$DEPLOY_DIR"/*
sudo -n cp -r dist/* "$DEPLOY_DIR"/
sudo -n chown -R caddy:caddy "$DEPLOY_DIR"

# Restart API — nama service produksi aktual adalah finepro-api.service
sudo -n systemctl restart finepro-api.service

echo "$NEW_COMMIT" > "$DEPLOY_DIR/.deployed_commit"
echo "=== $(date) Deploy OK ($NEW_COMMIT) ==="
