#!/usr/bin/env bash
# ============================================================
# Lifetopia Deploy Script — auto-sync to VPS
# ============================================================
# Usage:
#   VPS_HOST=user@1.2.3.4 VPS_WEB_ROOT=/var/www/lifetopia ./deploy.sh
#
# Or set defaults below, then just run: ./deploy.sh
# ============================================================

set -e

# ── Config — edit these ──────────────────────────────────────
VPS_HOST="${VPS_HOST:-root@YOUR_VPS_IP}"       # e.g. root@192.168.1.100
VPS_WEB_ROOT="${VPS_WEB_ROOT:-/var/www/lifetopia}"
VPS_NGINX_CONF="${VPS_NGINX_CONF:-/etc/nginx/sites-available/lifetopia}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
SSH_PORT="${SSH_PORT:-22}"
# ─────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_DIR/dist"
ENV_FILE="$PROJECT_DIR/.env"

echo "============================================"
echo " Lifetopia Deploy"
echo "============================================"
echo " VPS Host : $VPS_HOST"
echo " Web Root : $VPS_WEB_ROOT"
echo "============================================"

# 1. Check SSH key exists
if [[ ! -f "$SSH_KEY" ]]; then
  echo "[ERROR] SSH key not found: $SSH_KEY"
  echo "Create one with: ssh-keygen -t ed25519 -C 'shafiradev62@gmail.com' -f $SSH_KEY"
  exit 1
fi

# 2. Check .env exists
if [[ ! -f "$ENV_FILE" ]]; then
  echo "[ERROR] .env not found at $ENV_FILE"
  echo "Copy .env.example and fill in VITE_WALLET_DAPP_URL=https://your-domain.com"
  exit 1
fi

# 3. Check VITE_WALLET_DAPP_URL is set
if ! grep -q "VITE_WALLET_DAPP_URL=https://" "$ENV_FILE" 2>/dev/null; then
  echo "[ERROR] VITE_WALLET_DAPP_URL not set in .env"
  echo "Set it to your HTTPS domain, e.g.: VITE_WALLET_DAPP_URL=https://lifetopia.yourdomain.com"
  exit 1
fi

# 4. Build
echo ""
echo "[1/4] Building..."
cd "$PROJECT_DIR"
pnpm build

# 5. Check VPS connectivity
echo ""
echo "[2/4] Checking VPS connection..."
ssh -i "$SSH_KEY" -p "$SSH_PORT" -o ConnectTimeout=10 "$VPS_HOST" \
  "echo 'VPS OK' && mkdir -p $VPS_WEB_ROOT" || {
  echo "[ERROR] Cannot connect to VPS. Check host, IP, and SSH key."
  exit 1
}

# 6. Sync dist to VPS
echo ""
echo "[3/4] Syncing dist/ to VPS..."
rsync -avz \
  --delete \
  --exclude 'node_modules/' \
  --exclude 'android/' \
  --exclude '.git/' \
  --exclude '*.apk' \
  -e "ssh -i $SSH_KEY -p $SSH_PORT -o StrictHostKeyChecking=no" \
  "$DIST_DIR/" \
  "$VPS_HOST:$VPS_WEB_ROOT/"

# 7. Reload nginx
echo ""
echo "[4/4] Reloading nginx..."
ssh -i "$SSH_KEY" -p "$SSH_PORT" "$VPS_HOST" \
  "systemctl reload nginx && echo 'Nginx reloaded OK'"

echo ""
echo "============================================"
echo " Deploy SUCCESS!"
echo " URL: $(grep VITE_WALLET_DAPP_URL "$ENV_FILE" | cut -d= -f2)"
echo "============================================"
