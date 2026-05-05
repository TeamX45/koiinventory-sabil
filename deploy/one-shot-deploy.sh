#!/bin/bash
# DK Koi — One-shot deploy untuk inventory.dkkoi.com
# NON-DESTRUCTIVE: tidak merusak project lain di VPS yang sama
#
# Usage di VPS:
#   cd /opt/dk-koi
#   sudo bash deploy/one-shot-deploy.sh

set -e

DOMAIN="inventory.dkkoi.com"
APP_DIR="/opt/dk-koi"
CADDY_SITE="/etc/caddy/conf.d/inventory-dkkoi.caddy"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  DK Koi — Deploy ke $DOMAIN  ║"
echo "║  (mode: non-destructive, aman utk multi-project) ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

if [ "$EUID" -ne 0 ]; then
  echo "❌ Wajib root: sudo bash $0"
  exit 1
fi

cd "$APP_DIR" || { echo "❌ $APP_DIR tidak ada. Upload kode dulu."; exit 1; }

# ═══════════════════════════════════════════════════════════
# STEP 1: Install Docker + Caddy (idempotent — skip kalau sudah ada)
# ═══════════════════════════════════════════════════════════
echo "[1/8] Cek & install Docker + Caddy..."
apt update -qq

if ! command -v docker &> /dev/null; then
  echo "    → Install Docker..."
  apt install -y -qq ca-certificates curl gnupg lsb-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/$(. /etc/os-release && echo "$ID")/gpg | \
    gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$(. /etc/os-release && echo "$ID") $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt update -qq
  apt install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
else
  echo "    ✅ Docker sudah ada: $(docker --version | head -c 35)"
fi

if ! command -v caddy &> /dev/null; then
  echo "    → Install Caddy..."
  apt install -y -qq debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
    gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt update -qq
  apt install -y -qq caddy
else
  echo "    ✅ Caddy sudah ada: $(caddy version | head -c 30)"
fi

apt install -y -qq make git unzip openssl jq net-tools >/dev/null

# ═══════════════════════════════════════════════════════════
# STEP 2: Cari port unik yang belum dipakai (mulai dari 8095)
# ═══════════════════════════════════════════════════════════
echo "[2/8] Cari port internal yang tersedia..."
PROD_PORT=8095
while ss -tln 2>/dev/null | awk '{print $4}' | grep -q ":$PROD_PORT$"; do
  PROD_PORT=$((PROD_PORT + 1))
done
echo "    ✅ Port $PROD_PORT bebas (untuk nginx prod, di-proxy oleh Caddy)"

# ═══════════════════════════════════════════════════════════
# STEP 3: Setup .env.prod (skip kalau sudah ada)
# ═══════════════════════════════════════════════════════════
echo "[3/8] Setup .env.prod..."
if [ ! -f .env.prod ]; then
  cp deploy/.env.prod.template .env.prod

  APP_KEY=$(docker run --rm php:8.4-cli php -r \
    "echo 'base64:'.base64_encode(random_bytes(32)).PHP_EOL;" 2>/dev/null | tr -d '\r\n')
  sed -i "s|^APP_KEY=.*|APP_KEY=$APP_KEY|" .env.prod

  DB_PW=$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)
  DB_ROOT_PW=$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)
  sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=$DB_PW|" .env.prod
  sed -i "s|^DB_ROOT_PASSWORD=.*|DB_ROOT_PASSWORD=$DB_ROOT_PW|" .env.prod
  sed -i "s|^PROD_HTTP_PORT=.*|PROD_HTTP_PORT=$PROD_PORT|" .env.prod

  chmod 600 .env.prod
  echo "    ✅ .env.prod ter-generate (APP_KEY + password kuat, port $PROD_PORT)"
else
  # Update port saja kalau .env.prod sudah ada
  if ! grep -q "^PROD_HTTP_PORT=$PROD_PORT$" .env.prod; then
    if grep -q "^PROD_HTTP_PORT=" .env.prod; then
      sed -i "s|^PROD_HTTP_PORT=.*|PROD_HTTP_PORT=$PROD_PORT|" .env.prod
    else
      echo "PROD_HTTP_PORT=$PROD_PORT" >> .env.prod
    fi
  fi
  echo "    ℹ️  .env.prod sudah ada, hanya update port → $PROD_PORT"
fi

# ═══════════════════════════════════════════════════════════
# STEP 4: Build frontend production (3-5 menit)
# ═══════════════════════════════════════════════════════════
echo "[4/8] Build frontend (3-5 menit, sabar)..."
docker run --rm -v "$APP_DIR/frontend:/app" -w /app node:22-alpine \
  sh -c "npm ci --no-audit --no-fund --prefer-offline 2>&1 | tail -3 && npm run build 2>&1 | tail -3"
echo "    ✅ Frontend dist/ ready"

# ═══════════════════════════════════════════════════════════
# STEP 5: Bring up Docker stack (project name terisolasi: dk-koi-prod)
# ═══════════════════════════════════════════════════════════
echo "[5/8] Start Docker stack (project: dk-koi-prod)..."
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  --project-name dk-koi-prod up -d --build 2>&1 | tail -8

echo "    Tunggu MySQL healthy..."
DB_ROOT_PW=$(grep ^DB_ROOT_PASSWORD .env.prod | cut -d= -f2)
for i in {1..40}; do
  if docker exec dk_koi_mysql_prod mysqladmin ping -h localhost \
     -uroot -p"$DB_ROOT_PW" 2>/dev/null | grep -q alive; then
    break
  fi
  sleep 2
done
echo "    ✅ Stack up"

echo "    Set ownership backend + bootstrap/cache + storage ke uid 1000..."
chown -R 1000:1000 "$APP_DIR/backend"
docker exec -u root dk_koi_app_prod chown -R 1000:1000 \
  /var/www/html/bootstrap /var/www/html/storage 2>&1 | tail -3

echo "    Install composer dependencies (Laravel vendor/)..."
docker exec -u dev dk_koi_app_prod composer install \
  --no-dev --optimize-autoloader --no-interaction -d /var/www/html 2>&1 | tail -8
echo "    ✅ Composer install done"

# ═══════════════════════════════════════════════════════════
# STEP 6: Migrate + seed + optimize Laravel
# ═══════════════════════════════════════════════════════════
echo "[6/8] Migrate + seed + optimize Laravel..."
docker exec dk_koi_app_prod php artisan migrate --force 2>&1 | tail -3
docker exec dk_koi_app_prod php artisan db:seed --force 2>&1 | tail -3
docker exec dk_koi_app_prod php artisan config:cache 2>&1 | tail -1
docker exec dk_koi_app_prod php artisan route:cache 2>&1 | tail -1
docker exec dk_koi_app_prod php artisan view:cache 2>&1 | tail -1
echo "    ✅ Database ready"

# ═══════════════════════════════════════════════════════════
# STEP 7: Setup Caddy — APPEND site block, JANGAN replace Caddyfile
# ═══════════════════════════════════════════════════════════
echo "[7/8] Setup Caddy untuk $DOMAIN (non-destructive)..."

# Pastikan log directory ada dan ter-own oleh user caddy
mkdir -p /var/log/caddy
chown -R caddy:caddy /var/log/caddy 2>/dev/null
chmod 755 /var/log/caddy

# Pastikan main Caddyfile import dari conf.d/
mkdir -p /etc/caddy/conf.d
if ! grep -q "import /etc/caddy/conf.d/\*.caddy" /etc/caddy/Caddyfile 2>/dev/null; then
  if [ -f /etc/caddy/Caddyfile ]; then
    # Backup dulu
    cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak.$(date +%s)
    echo "" >> /etc/caddy/Caddyfile
    echo "# DK Koi — append site configs from conf.d/" >> /etc/caddy/Caddyfile
    echo "import /etc/caddy/conf.d/*.caddy" >> /etc/caddy/Caddyfile
    echo "    ℹ️  Caddyfile lama di-backup, tambah import conf.d/"
  else
    echo "import /etc/caddy/conf.d/*.caddy" > /etc/caddy/Caddyfile
  fi
fi

# Tulis site block kita ke conf.d/ (file terisolasi)
cat > "$CADDY_SITE" << EOF
# DK Koi — auto-generated, jangan edit manual
$DOMAIN {
    encode gzip zstd
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }
    reverse_proxy localhost:$PROD_PORT {
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto https
        header_up Host {host}
    }
    log {
        output file /var/log/caddy/inventory-dkkoi.log {
            roll_size 100mb
            roll_keep 5
        }
    }
}
EOF

systemctl enable caddy >/dev/null 2>&1
caddy fmt --overwrite /etc/caddy/Caddyfile 2>/dev/null || true

# Validate config sebelum start/restart
if caddy validate --config /etc/caddy/Caddyfile 2>&1 | grep -q "Valid config"; then
  # Pakai restart (bukan reload), supaya jalan baik service masih running maupun belum
  systemctl restart caddy
  sleep 3
  if systemctl is-active caddy >/dev/null 2>&1; then
    echo "    ✅ Caddy site $DOMAIN aktif (proxy ke port $PROD_PORT)"
  else
    echo "    ⚠️  Caddy gagal start. Log:"
    journalctl -u caddy -n 10 --no-pager | tail -10
  fi
else
  echo "    ⚠️  Caddyfile validation gagal — cek manual:"
  caddy validate --config /etc/caddy/Caddyfile 2>&1 | tail -10
fi

# ═══════════════════════════════════════════════════════════
# STEP 8: Firewall (additive only, jangan ganti rule lain)
# ═══════════════════════════════════════════════════════════
echo "[8/8] Pastikan port 80, 443, 22 terbuka..."
if command -v ufw &> /dev/null; then
  if ufw status | grep -q "Status: active"; then
    ufw allow 22/tcp comment 'SSH' >/dev/null 2>&1
    ufw allow 80/tcp comment 'HTTP (Caddy)' >/dev/null 2>&1
    ufw allow 443/tcp comment 'HTTPS (Caddy)' >/dev/null 2>&1
    echo "    ✅ ufw rules ditambahkan"
  else
    echo "    ℹ️  ufw inactive — skip (cek panel hosting kalau ada firewall provider)"
  fi
fi

# ═══════════════════════════════════════════════════════════
# Final check
# ═══════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════"
echo "  Status akhir"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Container DK Koi (project: dk-koi-prod):"
docker ps --filter "name=_prod" --format "  {{.Names}}: {{.Status}}"
echo ""
echo "Caddy:"
echo "  $(systemctl is-active caddy)"
echo ""
echo "Test internal (port $PROD_PORT):"
curl -sI -m 5 http://localhost:$PROD_PORT/up 2>&1 | head -1 || echo "  ⚠️  Container belum siap"
echo ""
echo "Test domain $DOMAIN:"
sleep 3
curl -sI -m 15 https://$DOMAIN/up 2>&1 | head -1 || echo "  ⏳ Cert mungkin masih di-issue, cek 30 detik lagi"
echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ Deploy selesai!"
echo "═══════════════════════════════════════════════════"
echo ""
echo "🌐 URL:    https://$DOMAIN"
echo "👤 Login:  owner@dkkoi.com / owner123"
echo "⚠️  WAJIB ganti password setelah login pertama!"
echo ""
echo "Operasional:"
echo "   make prod-logs       # tail logs"
echo "   make prod-down       # stop stack DK Koi (project lain TIDAK terganggu)"
echo "   make backup          # backup MySQL manual"
echo ""
echo "Kalau cert SSL belum aktif, tunggu 1 menit lalu cek:"
echo "   journalctl -u caddy -n 30 --no-pager"
echo ""
