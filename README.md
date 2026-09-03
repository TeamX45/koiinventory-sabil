# DK Koi — Sistem Manajemen Inventaris Ikan Koi

Aplikasi inventaris untuk peternak / pedagang ikan koi: melacak pembelian borong, panen,
sortir grade, penjualan multi-channel, dan stok opname dengan audit trail otomatis.

**Teknologi:** Laravel 13 (PHP 8.4) + React 19 + Tailwind 4 + MySQL 8 + Docker

## ✨ Fitur

- 🐟 **Inventaris real-time** — 24+ kolam, batch ikan, stok per grade, multi-lokasi
- 📦 **Pembelian borong** → terima (bisa langsung dipecah ke beberapa kolam) → sortir per grade → siap jual
- 🌱 **Panen kolam tanah** dengan flow yang sama
- 💰 **Penjualan multi-saluran** (marketplace, sosmed, offline) dengan diskon & ongkir
- 💀 **Catatan kematian ikan** dengan analisis penyebab + tren 14 hari
- 📊 **Stok opname** — koreksi selisih fisik vs sistem, sekaligus pintu masuk ikan yang belum tercatat
- 👥 **Multi-user** — owner / admin / staff dengan role-based access
- 🔄 **Sinkronisasi otomatis** — tabel ikut berubah saat staf lain menyimpan, tanpa refresh halaman
- 🧠 **Analisis AI** — membaca angka inventaris dan menjelaskan artinya; owner & admin saja
- 🌐 **Bahasa Indonesia** end-to-end (UI + validasi server)
- 🎨 **Brand customizable** lewat environment variable

## 🚀 Quick Start (Production)

### Prasyarat
- Docker 24+ & Docker Compose v2
- 2 GB RAM, 20 GB disk minimum
- (Optional) Domain + Caddy untuk HTTPS

### Setup pertama kali

```bash
# 1. Clone repo
git clone <url> dk-koi && cd dk-koi

# 2. Copy & edit env
cp .env.prod.example .env.prod
# WAJIB ganti: APP_KEY, DB_PASSWORD, DB_ROOT_PASSWORD, APP_URL, FRONTEND_URL
# Generate APP_KEY:
docker run --rm php:8.4-cli php -r "echo 'base64:'.base64_encode(random_bytes(32)).PHP_EOL;"

# 3. One-shot setup (build + up + migrate + seed)
make prod-setup
```

Buka http://localhost:8080. Login default: `owner@dkkoi.com` / `owner123` — **wajib ganti
password setelah login pertama**.

### Menjalankan operasional

```bash
make prod-up         # start stack
make prod-down       # stop stack
make prod-logs       # tail logs
make prod-shell      # masuk container
make backup          # backup MySQL manual (otomatis tiap 02:00)
```

## 🛠 Development

```bash
# Setup pertama kali (dev)
cp backend/.env.example backend/.env
make dev

# Frontend: http://localhost:5173
# API:      http://localhost:8500

# Run tests
make test

# Build frontend production
make build
```

## 🧠 Analisis AI (opsional)

Menu **Analisis AI** (di grup Aset, bawah Stok Ikan) merangkum 30 hari terakhir
— stok, pembelian, penjualan, kematian, pengeluaran — lalu menjelaskan apa
artinya dan apa yang perlu dikerjakan. Bisa juga ditanyai bebas, misalnya
*"kenapa stok saya menumpuk?"*.

Fiturnya opsional. Tanpa kunci API, menunya tetap ada tapi memberi tahu bahwa
fitur belum diaktifkan — tidak ada error.

### Mengaktifkan

1. Ambil kunci gratis di <https://aistudio.google.com/apikey>
2. Login sebagai **owner**, buka **Pengaturan → Analisis AI**, tempel kunci, Simpan
3. Klik **Muat daftar model**, pilih model, lalu **Uji koneksi**

Kuncinya tersimpan terenkripsi di database (pakai `APP_KEY`), bukan di `.env`.
Alasannya: di produksi `.env` di-mount read-only ke dalam container, jadi
pemilik tidak akan pernah bisa menggantinya sendiri lewat aplikasi.

Kalau lebih suka lewat berkas, `GEMINI_API_KEY` di `.env` tetap dipakai sebagai
cadangan bila database belum diisi. Untuk memeriksa nama model dari terminal:

```bash
docker exec dk_koi_app_prod php artisan ai:models
```

### Yang perlu diketahui

- **Yang dikirim ke Google hanya angka agregat** — total ekor, omzet, jumlah
  transaksi, nama kategori. Tidak ada nama pelanggan, telepon, atau alamat.
- **Analisis: owner & admin. Kunci API: owner saja** — kunci bisa dipakai
  membebani kuota, jadi pengaturannya lebih ketat daripada halamannya.
- **Dibatasi 20 permintaan per jam per user**, dan hasil yang sama ditahan 30
  menit, supaya kuota gratis tidak habis karena tombol ditekan berulang.
- **"Selisih beli vs jual" bukan laba bersih** — pakan, tenaga kerja, dan
  penyusutan tidak ada di data, dan AI diinstruksikan untuk tidak menyebutnya
  keuntungan bersih.

## 🎨 Branding Customization

Edit `.env.prod` untuk customer berbeda:

```bash
VITE_APP_NAME="Toko Koi Pak Joko"
VITE_APP_TAGLINE="Sistem Inventaris"
VITE_APP_DESCRIPTION="Manajemen ikan koi premium"
VITE_APP_YEAR="2026"
```

Lalu rebuild: `make prod-build && make prod-up`.

## 🌐 HTTPS dengan Caddy

```bash
sudo apt install caddy
sudo cp docker/caddy/Caddyfile.example /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile  # ganti app.example.com → domain Anda
sudo systemctl reload caddy
```

Caddy auto-issue Let's Encrypt cert. Detail lengkap di [DEPLOYMENT.md](DEPLOYMENT.md).

## 📂 Struktur

```
dk-koi/
├── backend/          # Laravel 13 API + tests
├── frontend/         # React 19 + Vite SPA
├── docker/           # Dockerfile prod, nginx, caddy, backup script
├── docker-compose.yml         # Dev stack (port 5173 + 8500)
├── docker-compose.prod.yml    # Prod stack (port 8080 internal, expose via Caddy)
├── Makefile          # make help untuk daftar perintah
├── DEPLOYMENT.md     # Panduan deploy lengkap
└── README.md
```

## 🔒 Security & Skalabilitas

- ✅ Rate limiting: 60 req/menit per user, login 5/menit per IP
- ✅ Pagination default 25/halaman, max 100 (cegah OOM)
- ✅ Composite index `(date, id)` di 7 tabel transaksional
- ✅ Dashboard cache 60 detik
- ✅ FK guard saat delete master (kolam masih dipakai → 422)
- ✅ Audit trail otomatis di `stock_movements` untuk semua perubahan stok
- ✅ Backup MySQL harian (retention 14 hari)
- ✅ HTTPS via Caddy (auto-renewal)
- ✅ Docker prod: OPcache JIT + opcache.validate_timestamps=0

**Kapasitas:** 100 ribu row per tabel, 50 user concurrent (single VPS 2GB RAM).
Untuk lebih: pakai Redis cache + queue, scale-out Laravel container.

## 🧪 Testing

```bash
make test
```

Test coverage:
- `StockOpnameServiceTest` — 4 case (selisih +/-, depleted, status guard)
- `PurchaseServiceTest` — receive flow + state guard
- `PaginationTest` — default 25, page param, max cap
- Total: 11 tests, 41 assertions

## 📝 License

Proprietary — hubungi vendor untuk lisensi penggunaan.

## 🆘 Support

Issue tracker: <repository_issues_url>
Email: <support@example.com>
