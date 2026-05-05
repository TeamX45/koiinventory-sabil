# Deployment Guide — DK Koi

Panduan deploy aplikasi ke production server (VPS Linux).

## Prasyarat server
- Ubuntu 22.04+ / Debian 12+ (atau Alpine)
- Docker 24+ & Docker Compose v2
- Domain dengan DNS A record ke server (untuk HTTPS)
- Minimal 2 GB RAM, 2 vCPU, 20 GB disk untuk skala 100rb row aktif

## 1. Clone & setup env

```bash
git clone <repo> dk-koi && cd dk-koi
cp backend/.env.production.example backend/.env
```

Edit `backend/.env` — **wajib ganti**:
- `APP_KEY` → `docker run --rm -v $(pwd)/backend:/app -w /app php:8.4-cli php artisan key:generate`
- `APP_URL` → `https://app.example.com`
- `DB_PASSWORD` & `DB_ROOT_PASSWORD` → password kuat (≥24 char)
- `FRONTEND_URL` & `SANCTUM_STATEFUL_DOMAINS` → domain frontend kamu

## 2. Build frontend

```bash
docker run --rm -v $(pwd)/frontend:/app -w /app node:22-alpine sh -c "npm ci && npm run build"
```

Output di `frontend/dist/`. Akan di-mount ke nginx.

## 3. Start stack production

```bash
docker compose -f docker-compose.prod.yml up -d
```

## 4. Run migration & cache config

```bash
docker exec dk_koi_app_prod php artisan migrate --force
docker exec dk_koi_app_prod php artisan db:seed --force
docker exec dk_koi_app_prod php artisan config:cache
docker exec dk_koi_app_prod php artisan route:cache
docker exec dk_koi_app_prod php artisan view:cache
docker exec dk_koi_app_prod php artisan event:cache
```

## 5. Setup HTTPS dengan Caddy

Install Caddy di host:
```bash
# Debian/Ubuntu
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy
```

Salin Caddyfile contoh:
```bash
sudo cp docker/caddy/Caddyfile.example /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile  # ganti app.example.com ke domain Anda
sudo systemctl reload caddy
```

Caddy auto-issue cert Let's Encrypt. Test: `curl -I https://app.example.com/up`.

## 6. Setup firewall

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# JANGAN buka port 3306, 8080, 5173 — internal saja
sudo ufw enable
```

## 7. Setup backup otomatis

Backup container sudah include di `docker-compose.prod.yml`. File backup masuk ke `./backups/` host folder, retention 14 hari, dump tiap 02:00 server time.

**Tambahan rekomendasi**: rsync `./backups/` ke S3/external storage:
```bash
# Cron job (crontab -e)
0 3 * * * aws s3 sync /opt/dk-koi/backups/ s3://your-bucket/dk-koi-backups/ --delete
```

## 8. Monitor & log

```bash
# Tail log Laravel
docker exec dk_koi_app_prod tail -f storage/logs/laravel.log

# Log nginx
docker logs -f dk_koi_nginx_prod

# Log Caddy
sudo journalctl -u caddy -f
```

## 9. Update aplikasi (zero-downtime)

```bash
git pull
# Rebuild frontend
docker run --rm -v $(pwd)/frontend:/app -w /app node:22-alpine sh -c "npm ci && npm run build"
# Migrate (kalau ada migration baru)
docker exec dk_koi_app_prod php artisan migrate --force
# Refresh cache
docker exec dk_koi_app_prod php artisan optimize:clear && \
docker exec dk_koi_app_prod php artisan optimize
# Restart php-fpm (drain koneksi lama)
docker exec dk_koi_app_prod kill -USR2 1
```

## 10. Disaster recovery

Restore dari backup:
```bash
gunzip < backups/dk_koi_20260502_020000.sql.gz | \
docker exec -i dk_koi_mysql_prod mysql -u root -p$DB_ROOT_PASSWORD dk_koi
```

## Skalabilitas

Konfigurasi saat ini cocok untuk:
- 1.000–100.000 row per tabel utama
- 10–50 user concurrent
- ~1.000 req/menit per user (dibatasi 60 req/menit/user via throttle)

Jika perlu lebih:
- **DB**: pindah MySQL ke managed service (RDS, DO Managed DB) — replikasi, snapshot otomatis
- **Cache**: tambah Redis (`CACHE_STORE=redis`, `SESSION_DRIVER=redis`, `QUEUE_CONNECTION=redis`)
- **Queue**: pisah container `php artisan queue:work` untuk operasi berat (sortir besar, export laporan)
- **Frontend**: serve `dist/` lewat CDN (CloudFront/Cloudflare) — kurangi beban origin

## Troubleshooting

**500 saat akses API setelah deploy**
- `docker exec dk_koi_app_prod php artisan config:clear`
- Cek `APP_KEY` ter-generate di `.env`

**HTTPS gagal issue cert**
- Pastikan port 80 & 443 terbuka di firewall
- DNS sudah propagate (`dig app.example.com`)
- Caddy logs: `journalctl -u caddy -e`

**Database migration gagal**
- Cek `DB_HOST=mysql` (bukan `127.0.0.1`)
- Cek MySQL container healthy: `docker ps`
