# DK Koi — Makefile untuk operational tasks
# Usage: make <target>

.PHONY: help dev prod-up prod-down prod-build prod-migrate prod-seed prod-shell prod-logs backup test build clean

DC_DEV  = docker compose
DC_PROD = docker compose -f docker-compose.prod.yml --env-file .env.prod --project-name dk-koi-prod

help:
	@echo "DK Koi — perintah yang tersedia:"
	@echo ""
	@echo "  Development:"
	@echo "    make dev              Jalankan stack development (port 5173 + 8500)"
	@echo "    make dev-down         Stop stack development"
	@echo "    make test             Jalankan PHPUnit tests"
	@echo "    make build            Build frontend production"
	@echo ""
	@echo "  Production:"
	@echo "    make prod-build       Build frontend untuk production"
	@echo "    make prod-up          Bring up production stack (port 8080)"
	@echo "    make prod-down        Stop production stack"
	@echo "    make prod-migrate     Jalankan database migration"
	@echo "    make prod-seed        Seed master data (locations, grades, dll)"
	@echo "    make prod-optimize    Cache config + routes + views (faster boot)"
	@echo "    make prod-shell       Masuk shell PHP container"
	@echo "    make prod-logs        Tail logs production"
	@echo "    make prod-setup       One-shot: build + up + migrate + seed + optimize"
	@echo "    make backup           Run MySQL backup manual"
	@echo ""
	@echo "  Maintenance:"
	@echo "    make clean            Hapus volume + container (DESTRUKTIF)"

# ---------- Development ----------
dev:
	$(DC_DEV) up -d
	@echo "Frontend: http://localhost:5173"
	@echo "API:      http://localhost:8500"

dev-down:
	$(DC_DEV) down

test:
	$(DC_DEV) exec app php artisan test

build:
	$(DC_DEV) exec frontend npm run build

# ---------- Production ----------
prod-build:
	docker run --rm -v $(PWD)/frontend:/app -w /app node:22-alpine sh -c "npm ci --no-audit --no-fund && npm run build"

prod-up:
	$(DC_PROD) up -d
	@echo "Aplikasi: http://localhost:8080"

prod-down:
	$(DC_PROD) down
	@echo "Membersihkan config cache prod (mencegah konflik ke dev)..."
	-@rm -f backend/bootstrap/cache/config.php backend/bootstrap/cache/routes-v7.php backend/bootstrap/cache/services.php backend/bootstrap/cache/packages.php

prod-migrate:
	$(DC_PROD) exec app php artisan migrate --force

prod-seed:
	$(DC_PROD) exec app php artisan db:seed --force

prod-optimize:
	$(DC_PROD) exec app php artisan config:cache
	$(DC_PROD) exec app php artisan route:cache
	$(DC_PROD) exec app php artisan view:cache
	$(DC_PROD) exec app php artisan event:cache

prod-shell:
	$(DC_PROD) exec app sh

prod-logs:
	$(DC_PROD) logs -f --tail=100

# One-shot setup pertama kali
prod-setup: prod-build prod-up
	@echo "Tunggu MySQL ready..."
	@sleep 10
	@$(MAKE) prod-migrate
	@$(MAKE) prod-seed
	@$(MAKE) prod-optimize
	@echo ""
	@echo "✅ Setup selesai. Buka http://localhost:8080"
	@echo "   Default login: owner@dkkoi.com / owner123 (GANTI setelah login!)"

backup:
	$(DC_PROD) exec backup sh /usr/local/bin/run.sh

# ---------- Maintenance ----------
clean:
	@echo "⚠️  Akan hapus container + volume DB. Konfirmasi (y/N)?"
	@read ans && [ "$$ans" = "y" ] || (echo "Dibatalkan" && exit 1)
	$(DC_DEV) down -v
	$(DC_PROD) down -v
