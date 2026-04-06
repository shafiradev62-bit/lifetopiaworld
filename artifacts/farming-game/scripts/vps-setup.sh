#!/usr/bin/env bash
# ============================================================
# Lifetopia VPS Setup — JALANKAN SEKALI di VPS kamu
# ============================================================
# Usage (on VPS):
#   curl -fsSL https://raw.githubusercontent.com/shafiradev62-bit/lifetopia-app/master/scripts/vps-setup.sh | bash
#   -- ATAU copy file ini ke VPS lalu: bash vps-setup.sh yourdomain.com
# ============================================================

set -e

DOMAIN="${1:-}"
WEB_ROOT="/var/www/lifetopia"
NGINX_CONF="/etc/nginx/sites-available/lifetopia"

if [[ -z "$DOMAIN" ]]; then
  echo "Usage: bash vps-setup.sh yourdomain.com"
  echo "Example: bash vps-setup.sh lifetopia.shafira.dev"
  exit 1
fi

echo "============================================"
echo " Lifetopia VPS Setup"
echo " Domain: $DOMAIN"
echo " Web Root: $WEB_ROOT"
echo "============================================"

echo "[1/5] Updating system..."
apt update && apt upgrade -y

echo "[2/5] Installing nginx, certbot..."
apt install -y nginx certbot python3-certbot-nginx ufw

echo "[3/5] Creating web root..."
mkdir -p "$WEB_ROOT"
chown -R www-data:www-data "$WEB_ROOT"

echo "[4/5] Configuring nginx..."
cat > "$NGINX_CONF" << NGINX_EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    root $WEB_ROOT;
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # SPA routing
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Cache static assets (Vite hashed files)
    location ~* \.(js|css|woff2|png|svg|ico|webp)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    # No cache for index.html
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json image/svg+xml;
}
NGINX_EOF

# Enable site
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/lifetopia
rm -f /etc/nginx/sites-enabled/default

# Test & reload
nginx -t && systemctl reload nginx

echo "[5/5] Firewall..."
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw --force enable

echo ""
echo "============================================"
echo " NGINX SETUP DONE!"
echo "============================================"
echo ""
echo "NEXT STEPS:"
echo ""
echo "1. Point your DNS A record to this VPS IP"
echo "   $DOMAIN → YOUR_VPS_IP"
echo ""
echo "2. Wait for DNS propagation (~5 min), then run:"
echo "   certbot --nginx -d $DOMAIN"
echo ""
echo "3. Add this SSH public key to authorized_keys:"
echo ""
cat ~/.ssh/authorized_keys 2>/dev/null || echo "(No keys found yet — add your local SSH key)"
echo ""
echo "   Your local SSH public key (from \$HOME/.ssh/id_ed25519.pub):"
if [[ -f "$HOME/.ssh/id_ed25519.pub" ]]; then
  cat "$HOME/.ssh/id_ed25519.pub"
else
  echo "   Run on LOCAL computer: cat ~/.ssh/id_ed25519.pub"
fi
echo ""
echo "4. Back on LOCAL computer, edit .env:"
echo "   VITE_WALLET_DAPP_URL=https://$DOMAIN"
echo ""
echo "5. Then deploy:"
echo "   VPS_HOST=user@YOUR_VPS_IP ./scripts/deploy.sh"
echo "============================================"
