# DK Koi — Setup Guide

Project ini menggunakan **Docker Compose** untuk menjalankan seluruh stack.

## Prasyarat
- Docker Desktop (Windows / macOS) atau Docker Engine + Compose plugin
- Git

## Struktur Project

```
koi/
├── docker-compose.yml          # orkestrasi semua service
├── .env                        # konfigurasi (port, db credentials)
├── docker/                     # Dockerfile + config tiap service
│   ├── php/Dockerfile
│   ├── nginx/default.conf
│   ├── node/Dockerfile
│   └── mysql/my.cnf
├── backend/                    # Laravel 13 (API)
├── frontend/                   # React 18 + Vite + TS
└── docs/                       # Dokumentasi
```

## Service yang Dijalankan

| Service     | Port  | URL                       |
|-------------|-------|---------------------------|
| nginx (API) | 8000  | http://localhost:8000     |
| frontend    | 5173  | http://localhost:5173     |
| mysql       | 3306  | localhost:3306            |
| phpmyadmin  | 8080  | http://localhost:8080     |

## Langkah Awal (sekali saja)

### 1. Init Laravel 13 di folder backend
```bash
docker compose run --rm app composer create-project laravel/laravel:^13 .
```
Setelah selesai, salin `.env.example` jadi `.env` di backend, lalu set:
```env
APP_URL=http://localhost:8000
DB_CONNECTION=mysql
DB_HOST=mysql
DB_PORT=3306
DB_DATABASE=dk_koi
DB_USERNAME=koi
DB_PASSWORD=koi_secret
```

### 2. Pindahkan migrations & models yang sudah disiapkan
Migration files di `backend/database/migrations/` dan models di `backend/app/Models/` sudah dibuat — jangan ditimpa saat Laravel di-init. Jika perlu, backup dulu lalu kembalikan setelah `composer create-project`.

### 3. Generate app key & jalankan migrasi + seeder
```bash
docker compose run --rm app php artisan key:generate
docker compose run --rm app php artisan migrate --seed
```

### 4. Build & start semua service
```bash
docker compose up -d --build
```

### 5. Akses
- API:        http://localhost:8000/api
- Frontend:   http://localhost:5173
- phpMyAdmin: http://localhost:8080

## Perintah Berguna

```bash
# Lihat log
docker compose logs -f app
docker compose logs -f frontend

# Masuk ke container PHP
docker compose exec app bash

# Re-run migration dari nol
docker compose exec app php artisan migrate:fresh --seed

# Install paket Laravel
docker compose exec app composer require <package>

# Install paket NPM (frontend)
docker compose exec frontend npm install <package>

# Stop semua
docker compose down

# Stop + hapus volume MySQL (RESET database!)
docker compose down -v
```

## Catatan untuk Windows
- Gunakan **WSL2** sebagai backend Docker Desktop untuk performa filesystem yang lebih baik.
- Pastikan project disimpan di filesystem WSL (`\\wsl$\Ubuntu\...`) jika memungkinkan, bukan `C:\` mount.
