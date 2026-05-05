#!/bin/bash
# DK Koi — VPS bootstrap script untuk Ubuntu 22.04+ / Debian 12+
# Install Docker, Docker Compose, Caddy, lalu setup project
#
# Usage di VPS:
#   sudo bash deploy/server-setup.sh

set -e

echo "=================================================="
echo " DK Koi — VPS Setup"
echo "=================================================="
echo ""

# Cek root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Jalankan dengan sudo: sudo bash $0"
  exit 1
fi

# Cek OS
if ! command -v apt &> /dev/null; then
  echo "❌ Script ini cuma support Ubuntu/Debian"
  exit 1
fi

# ----- Update sistem -----
echo "📦 Update package list..."
apt update -qq
apt upgrade -y -qq

# ----- Install Docker -----
if ! command -v docker &> /dev/null; then
  echo "🐳 Install Docker..."
  apt install -y -qq ca-certificates curl gnupg lsb-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/$(. /etc/os-release && echo "$ID")/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$(. /etc/os-release && echo "$ID") $(lsb_release -cs) stable" \
    | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt update -qq
  apt install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
else
  echo "✅ Docker sudah terinstall: $(docker --version)"
fi

# ----- Install Caddy -----
if ! command -v caddy &> /dev/null; then
  echo "🔒 Install Caddy (untuk HTTPS auto)..."
  apt install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
  apt update -qq
  apt install -y -qq caddy
  systemctl enable --now caddy
else
  echo "✅ Caddy sudah terinstall: $(caddy version)"
fi

# ----- Firewall -----
if command -v ufw &> /dev/null; then
  echo "🛡  Setup firewall..."
  ufw allow OpenSSH 2>/dev/null || ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
  echo "✅ Firewall: SSH + HTTP + HTTPS only"
fi

# ----- Make + git -----
apt install -y -qq make git unzip

# ----- Buat directory project -----
APP_DIR="/opt/dk-koi"
if [ ! -d "$APP_DIR" ]; then
  mkdir -p "$APP_DIR"
fi
chown -R $SUDO_USER:$SUDO_USER "$APP_DIR" 2>/dev/null || true

echo ""
echo "=================================================="
echo "✅ Server siap. Langkah selanjutnya:"
echo "=================================================="
echo ""
echo "1. Upload kode project ke $APP_DIR/ (lihat README deploy)"
echo "2. cd $APP_DIR"
echo "3. cp .env.prod.example .env.prod && nano .env.prod  # ganti secrets"
echo "4. make prod-setup"
echo "5. cp deploy/Caddyfile /etc/caddy/Caddyfile"
echo "6. systemctl reload caddy"
echo ""
echo "URL aplikasi: https://inventory.dkkoi.com"
echo ""
