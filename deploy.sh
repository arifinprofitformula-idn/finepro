#!/bin/bash
# /home/ubuntu/projects/finepro/deploy.sh
# Dijalankan oleh webhook GitHub — auto deploy: pull → migrate → build → copy
set -e

PROJECT_DIR="/home/ubuntu/projects/finepro"
DEPLOY_DIR="/var/www/finepro"
LOG_FILE="/tmp/finepro-deploy.log"

exec >> "$LOG_FILE" 2>&1
echo "=== $(date) Deploy started ==="

cd "$PROJECT_DIR"
git fetch origin main
git reset --hard origin/main

# Migrasi database
for f in supabase/migrations/*.sql; do
    echo "Running migration: $f"
    PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U keuangan_app -d keuangan -f "$f"
done

# Install dependencies
npm install --production=false
cd api && npm install --production=false && cd ..

# Build frontend
npm run build

# Deploy
sudo rm -rf "$DEPLOY_DIR"/*
sudo cp -r dist/* "$DEPLOY_DIR"/
sudo chown -R caddy:caddy "$DEPLOY_DIR"

# Restart API
sudo systemctl restart keuangan-api

echo "=== $(date) Deploy OK ==="
