# Multi-Tenant Roadmap

Dokumen ini bukan changelog. Dokumen ini **rencana refaktor**: apa yang harus
diubah, urutannya, dan trade-off-nya — supaya keputusan eksekusi bisa diambil
sadar (siapa pelanggan target, model bisnis, budget operasional, dll) sebelum
menulis kode.

## Kenapa belum dieksekusi sekarang

Multi-tenant SaaS adalah **redesign skala-besar** yang menyentuh hampir semua
tabel transaksional + auth + caching + backup + billing. Estimasi konservatif
2–4 minggu kerja terkonsentrasi (sendirian) atau 1–2 minggu tim 2 orang. Kalau
salah pilih strategi di awal, biaya migrasi nanti besar. Lebih baik eksplisit
dulu sebelum menulis baris pertama.

## Tiga strategi utama (pilih salah satu)

### Strategi 1 — Single DB, shared schema, `tenant_id` di setiap tabel (paling umum)

- Tambah kolom `tenant_id` ke tabel: `users`, `locations`, `ponds`, `batches`,
  `purchases`, `sortings`, `sales`, `stock_opnames`, `mortalities`, `suppliers`,
  `fish_types` (?), `grades` (?), `pond_categories` (?), `audit_logs`.
- `BelongsToTenant` trait + global scope di model: otomatis filter `WHERE tenant_id = X`.
- Auth: tambah `current_tenant_id` di session/Sanctum token.
- Trade-off:
  - ✅ Murah operasional: 1 DB, 1 backup, 1 deploy.
  - ✅ Cross-tenant analytic mudah (admin SaaS).
  - ❌ Risiko bocor data kalau scope query dilewati (1 SQL salah = leak).
  - ❌ Index size membengkak: query selalu butuh `(tenant_id, ...)`.
  - ❌ Tidak bisa beda versi schema per tenant.

### Strategi 2 — Database per tenant (isolated)

- Tiap tenant punya DB sendiri (schema sama). Connection di-switch berdasarkan
  user yang login.
- Trade-off:
  - ✅ Isolation kuat: data leak hampir mustahil.
  - ✅ Backup/restore per pelanggan.
  - ✅ Scale per-tenant lebih mudah.
  - ❌ Operasional mahal: N database, N migration, N backup job.
  - ❌ Cross-tenant report sulit (perlu agregasi terpisah).
  - ❌ Onboarding tenant baru = create DB + run migration.

### Strategi 3 — Single instance per pelanggan (current — 1 server, 1 customer)

- Tiap pelanggan deploy sendiri (atau Anda host 1 instance Docker per customer).
- Trade-off:
  - ✅ No code change.
  - ✅ Isolasi paling kuat.
  - ❌ Mahal: tiap pelanggan = 1 VM/hosting.
  - ❌ Tidak scale ke 100+ pelanggan.
  - ❌ Update versi = banyak deploy.

**Rekomendasi:** Strategi **1 (shared schema dengan tenant_id)** kalau target ≥10
pelanggan dengan budget hosting terbatas. Strategi **2** kalau pelanggan besar
(>1000 ekor stok per farm, butuh isolasi data ketat). Strategi **3** kalau 1–3
pelanggan high-touch.

## Eksekusi Strategi 1 — checklist

Asumsi: pilih shared schema dengan tenant_id.

### Phase 1 — Schema & Model (5–7 hari)

- [ ] Migration: tambah `tenant_id` (FK ke `tenants`) ke 14 tabel transaksional.
- [ ] Tabel `tenants` baru: `id, name, slug, plan, is_active, billing_email, created_at`.
- [ ] Composite index `(tenant_id, ...)` di tabel high-volume: `batches(tenant_id, status)`,
      `stock_opnames(tenant_id, opname_date)`, `audit_logs(tenant_id, created_at)`, dll.
- [ ] Model trait `BelongsToTenant` dengan `boot()` + global scope. Pasang di semua
      model transaksional.
- [ ] Foreign key cascade-on-delete dari tenants ke entitas anak — atau soft-delete-only.

### Phase 2 — Auth & Routing (3–4 hari)

- [ ] User: tambah relasi `tenant_id` (1 user = 1 tenant) atau pivot
      `tenant_user` kalau user bisa join banyak tenant.
- [ ] Middleware `EnsureTenantContext` setelah `auth:sanctum`: set
      `app('tenant')` dari `request->user()->tenant_id`.
- [ ] Sanctum token abilities: `["tenant:{$tenantId}"]`.
- [ ] Route group: `Route::middleware(['auth:sanctum', 'tenant'])->prefix('v1')...`
- [ ] Login response: include tenant info + slug.

### Phase 3 — Controller & Service refactor (4–6 hari)

- [ ] Audit semua `Model::create()` di controller — pastikan tenant_id terisi
      otomatis (via trait observer atau eksplisit).
- [ ] Audit semua `whereHas`, `with`, `find` — global scope harus auto-filter.
- [ ] Endpoint admin SaaS (cross-tenant): pakai `withoutGlobalScope`.
- [ ] FK validation harus check `tenant_id` cocok (mis. saat sale ke batch_id,
      pastikan batch milik tenant yang login).

### Phase 4 — Migration data existing (1 hari + downtime planning)

- [ ] Buat default tenant "Legacy" untuk data eksisting.
- [ ] Backfill `tenant_id = legacy_tenant_id` di semua tabel.
- [ ] Set NOT NULL setelah backfill selesai.
- [ ] Test rollback path.

### Phase 5 — UI changes (3–5 hari)

- [ ] Tenant switcher (kalau user multi-tenant).
- [ ] Branding per tenant (nama, logo) di header.
- [ ] Billing page (kalau SaaS): plan, usage, invoice.
- [ ] Onboarding flow: signup → buat tenant → invite team → tambah lokasi → import data.

### Phase 6 — Operasional (2–3 hari)

- [ ] Backup script: dump per tenant_id ke S3/storage terpisah.
- [ ] Audit log: tambah tenant_id agar admin SaaS bisa filter per pelanggan.
- [ ] Rate limiter: per tenant (bukan per IP) supaya 1 tenant nakal tidak ganggu lainnya.
- [ ] Cache key prefix: `tenant:{id}:dashboard:summary` agar dashboard cache tidak bocor.
- [ ] Monitoring: metric per tenant (storage, request, dll).

### Phase 7 — Billing (kalau SaaS — 1–2 minggu, lihat Phase X)

- [ ] Integrasi Midtrans / Xendit / Stripe.
- [ ] Tabel `subscriptions`, `invoices`, `payment_attempts`.
- [ ] Webhook handler.
- [ ] Plan-based feature gates (mis. free = max 5 kolam, pro = unlimited).
- [ ] Cron: tagih bulanan, suspend tenant kalau gagal bayar.

**Total estimasi Phase 1–6:** ~3 minggu (1 dev fokus).
**Tambah Phase 7 (billing):** +1–2 minggu.

## Risiko utama yang harus diwaspadai

1. **Data leak via N+1 / eager loading.** Eloquent eager-load via `with()` tidak
   selalu kena global scope — harus eksplisit `with(['batches' => fn ($q) => $q->...])`
   di tempat-tempat sensitif.
2. **Background jobs.** Job yang dispatch dari context tenant A harus tahu tenant
   mana saat di-execute worker — tidak bisa mengandalkan request scope. Pakai
   middleware queue atau pass tenant_id eksplisit ke constructor job.
3. **Soft delete + tenant switch.** Kalau tenant di-suspend (soft delete),
   pastikan semua data terkait tidak terlihat user lain (cascade scope).
4. **Caching.** Dashboard cache key sekarang `dashboard:summary` global. Multi-tenant
   harus per-tenant atau bocor antar pelanggan.
5. **Audit log.** Sudah disiapkan polymorphic. Tambah `tenant_id` saat Phase 1.

## Test strategy

- Kontrak: setiap controller test dijalankan dengan minimal 2 tenant, assert
  data tenant A tidak muncul saat user tenant B request.
- Add `MultiTenantTestCase` base yang setup 2 tenant + data dummy di each.
- Coverage target: 80% di service + controller layer.

## Alternatif lebih ringan: feature-flagged "team mode"

Kalau target user awal cuma 1–3 farm dan belum mau full SaaS:

- Tambah konsep "team" sebagai pivot user-team (banyak user bisa share data).
- Tidak perlu tenant_id di setiap tabel. Cukup `team_id` di Pond/Batch level.
- Lebih cepat (1 minggu) tapi tidak scale ke true SaaS.

Ini bisa jadi **transisi**: deploy team-mode dulu untuk validasi pasar, baru
upgrade ke full multi-tenant kalau pelanggan tumbuh.
