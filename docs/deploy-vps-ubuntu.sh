#!/bin/bash
# ============================================================
# Deploy Keuangan Keluarga PWA ke VPS Ubuntu
# Jalankan LANGSUNG DI VPS (via SSH), sebagai user dengan akses sudo.
#
# Project ini pakai Vite. Sebelum menjalankan skrip ini, di KOMPUTER
# ANDA (bukan di VPS):
#     npm install && npm run build
#     scp -r dist/* root@<VPS_IP>:/var/www/keuangan/
# Baru setelah isi dist/ ada di /var/www/keuangan, jalankan skrip ini.
# ============================================================
set -e

# --- ISI INI DULU ---
VPS_IP="123.45.67.89"          # ganti dengan IP VPS Anda
DOMAIN="${VPS_IP}.nip.io"      # otomatis jadi domain gratis; ganti jika sudah punya domain asli
EMAIL="contact.bustanul@gmail.com"   # untuk notifikasi sertifikat SSL dari Let's Encrypt
# ---------------------

echo "== Deploy target: https://${DOMAIN} =="

echo "[1/6] Update sistem & install Nginx + Certbot..."
sudo apt update -y
sudo apt install -y nginx certbot python3-certbot-nginx

echo "[2/6] Siapkan folder aplikasi..."
sudo mkdir -p /var/www/keuangan
sudo chown -R "$USER":"$USER" /var/www/keuangan
echo "   -> Pastikan ISI folder dist/ (hasil 'npm run build') sudah diupload ke /var/www/keuangan"

echo "[3/6] Pasang konfigurasi Nginx..."
sudo tee /etc/nginx/sites-available/keuangan > /dev/null <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    root /var/www/keuangan;
    index index.html;

    location = /sw.js {
        add_header Cache-Control "no-cache";
        try_files \$uri =404;
    }
    location = /manifest.webmanifest {
        add_header Cache-Control "no-cache";
        try_files \$uri =404;
    }
    location ~* \.(css|js|png|jpg|jpeg|svg|ico|webmanifest)\$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    location ~ /\. {
        deny all;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/keuangan /etc/nginx/sites-enabled/keuangan
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

echo "[4/6] Buka firewall untuk HTTP/HTTPS (jika UFW aktif)..."
if command -v ufw >/dev/null 2>&1; then
  sudo ufw allow 'Nginx Full' || true
fi

echo "[5/6] Pasang SSL gratis (Let's Encrypt)..."
sudo certbot --nginx -d "${DOMAIN}" -m "${EMAIL}" --agree-tos --non-interactive --redirect

echo "[6/6] Selesai. Cek status:"
sudo systemctl status nginx --no-pager | head -5
echo ""
echo "============================================================"
echo " Aplikasi Anda: https://${DOMAIN}"
echo " Langkah selanjutnya (WAJIB, manual):"
echo " 1. Buka Supabase Dashboard > Authentication > URL Configuration"
echo "    - Site URL       : https://${DOMAIN}"
echo "    - Redirect URLs  : https://${DOMAIN}/*"
echo " 2. Buka https://${DOMAIN} di HP, coba 'Add to Home Screen'"
echo "============================================================"
