# Deploy DK Koi ke inventory.dkkoi.com

VPS: **`72.60.112.88`** (root@72.60.112.88)
Domain: **`inventory.dkkoi.com`**

⚠️ **Mode non-destructive**: deploy ini AMAN dijalankan di VPS yang sudah ada
project lain. Tidak menimpa Caddyfile, port unik dipilih otomatis, container/volume
ter-isolasi (prefix `dk_koi_*_prod`).

---

## Prasyarat

- [ ] DNS A record `inventory.dkkoi.com` → `72.60.112.88` (verify: `nslookup inventory.dkkoi.com`)
- [ ] Akses SSH ke `root@72.60.112.88` (key authentication)
- [ ] VPS Ubuntu 22.04+ atau Debian 12+ (min 2 GB RAM)

---

## Deploy dalam 2 command

Buka **PowerShell** di laptop kamu, masuk ke folder project:

```powershell
cd C:\Users\DELL\Documents\koi
```

### Command 1 — Upload code ke VPS

```powershell
# Buat tarball (exclude file besar yg tidak perlu)
tar --exclude='node_modules' --exclude='frontend/dist' `
    --exclude='backend/vendor' --exclude='backend/storage/logs/*.log' `
    --exclude='.env.prod' --exclude='backend/.env' --exclude='.git' `
    --exclude='backups' --exclude='backend/bootstrap/cache/*.php' `
    -czf $env:TEMP\dk-koi.tar.gz .

# Upload + extract di VPS
scp $env:TEMP\dk-koi.tar.gz root@72.60.112.88:/tmp/
ssh root@72.60.112.88 "mkdir -p /opt/dk-koi && tar -xzf /tmp/dk-koi.tar.gz -C /opt/dk-koi/ && rm /tmp/dk-koi.tar.gz && echo '✅ Code uploaded'"
```

### Command 2 — Auto-deploy

```powershell
ssh root@72.60.112.88 "cd /opt/dk-koi && bash deploy/one-shot-deploy.sh"
```

Tunggu **5-8 menit**. Sebagian besar waktu di build frontend (3-5 menit).

---

## Apa yang dilakukan script (otomatis, non-destructive)

| Step | Aksi | Apakah merusak project lain? |
|------|------|------------------------------|
| 1 | Install Docker + Caddy (skip kalau sudah ada) | ❌ Tidak |
| 2 | Pilih port internal unik (mulai 8095, naik kalau dipakai) | ❌ Tidak |
| 3 | Generate `.env.prod` dengan APP_KEY + password kuat | ❌ Tidak |
| 4 | Build frontend di Docker container terisolasi | ❌ Tidak |
| 5 | Bring up Docker stack (project: `dk-koi-prod`, container `dk_koi_*_prod`) | ❌ Tidak |
| 6 | Migrate + seed database `dk_koi` di MySQL container terpisah | ❌ Tidak |
| 7 | Tulis site block ke `/etc/caddy/conf.d/inventory-dkkoi.caddy` (BUKAN replace Caddyfile) | ❌ Tidak |
| 8 | Tambah ufw rule 22/80/443 (additive, tidak hapus rule lain) | ❌ Tidak |

**Container yang akan dibuat:**
- `dk_koi_app_prod` (PHP-FPM Laravel)
- `dk_koi_nginx_prod` (nginx, listen di port 8095 atau lebih)
- `dk_koi_mysql_prod` (MySQL data terisolasi di volume `dk-koi-prod_mysql_prod_data`)
- `dk_koi_backup_prod` (backup harian MySQL)

**Caddy Site:**
- File config: `/etc/caddy/conf.d/inventory-dkkoi.caddy`
- File ini hanya untuk `inventory.dkkoi.com` — site lain tetap berjalan
- Caddyfile utama hanya dimodifikasi untuk `import conf.d/*.caddy` (kalau belum ada)

---

## ✅ Setelah deploy selesai

Script akan tampilkan:
```
🌐 URL:    https://inventory.dkkoi.com
👤 Login:  owner@dkkoi.com / owner123
```

1. Buka https://inventory.dkkoi.com
2. Login dengan kredensial default
3. **WAJIB ganti password** di menu **Profil Saya**

---

## 🆘 Troubleshooting

### Cert HTTPS belum aktif setelah 1 menit

```bash
ssh root@72.60.112.88 "journalctl -u caddy -n 50 --no-pager"
```

Penyebab umum:
- DNS belum propagate sempurna (`dig inventory.dkkoi.com @8.8.8.8`)
- Provider hosting block port 80 sementara untuk Let's Encrypt challenge

### Container dk_koi_app_prod restart loop

```bash
ssh root@72.60.112.88 "docker logs dk_koi_app_prod --tail=50"
```

### 502 Bad Gateway dari domain

Container belum ready. Tunggu 30 detik, atau cek:
```bash
ssh root@72.60.112.88 "docker ps --filter name=_prod && curl -sI http://localhost:8095/up"
```

---

## 🔧 Operasional

```bash
# SSH ke VPS
ssh root@72.60.112.88

cd /opt/dk-koi

# Tail logs DK Koi (project lain tidak terganggu)
make prod-logs

# Restart DK Koi saja
make prod-down
make prod-up
make prod-optimize

# Backup MySQL manual (selain otomatis 02:00)
make backup

# Update aplikasi (rsync ulang dari laptop kamu, lalu)
make prod-build       # rebuild frontend
docker exec dk_koi_app_prod php artisan migrate --force
make prod-optimize
```

## 🗑 Uninstall (kalau mau hapus DK Koi total tanpa ganggu project lain)

```bash
ssh root@72.60.112.88
cd /opt/dk-koi
make prod-down
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  --project-name dk-koi-prod down -v   # hapus volume DB
sudo rm -rf /opt/dk-koi
sudo rm /etc/caddy/conf.d/inventory-dkkoi.caddy
sudo systemctl reload caddy
```

Project & site lain di VPS **tidak akan terganggu**.
