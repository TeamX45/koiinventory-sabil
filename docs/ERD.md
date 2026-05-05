# DK Koi — Skema Database (ERD)

## Ringkasan Tabel

| # | Tabel | Fungsi |
|---|---|---|
| 1 | `locations` | 3 lokasi: Sukaraja, Ds. Keramat, Ds. Penican |
| 2 | `pond_categories` | Kategori kolam (Indukan, Jumbo, Kontes, Small, Pembesaran, Penangkaran) |
| 3 | `ponds` | 17 kolam + 7 aquarium = 24 unit |
| 4 | `fish_types` | Jenis ikan: koi (Kohaku, Sanke, ...) & penjinak (Karasi, Cagoi, ...) |
| 5 | `grades` | Show Quality, Grade A, Grade B |
| 6 | `sales_channels` | Tokopedia, Shopee, IG, FB, TikTok, WA, Offline |
| 7 | `suppliers` | Pemasok (petani koi) |
| 8 | `purchases` | Header pembelian borong (supplier, total ekor, subtotal) |
| 9 | `harvests` | Panen dari kolam tanah |
| 10 | `batches` | Grup ikan (per pembelian / per panen / per hasil sortir) |
| 11 | `sortings` | Header proses sortir |
| 12 | `sorting_results` | Distribusi hasil sortir per grade ke kolam target |
| 13 | `stock_movements` | Log mutasi stok (audit trail) |
| 14 | `sales` | Header penjualan |
| 15 | `sale_items` | Item penjualan per batch |
| 16 | `mortalities` | Catatan kematian ikan |

## Relasi Antar Tabel

```
locations (1) ────< (N) ponds >──── (N) pond_categories
                       │
                       └────< (N) batches
                                    │
                       ┌────────────┼────────────┐
                       │            │            │
                  source_type:  parent_batch  fish_type / grade
                  purchase                  ──< grades, fish_types
                  harvest
                  sorting
                       │
                       ├────< (N) stock_movements
                       ├────< (N) mortalities
                       └────< (N) sale_items >──── (1) sales >──── sales_channels

suppliers (1) ────< (N) purchases ────[source]──── batches
ponds[tanah] (1) ──< (N) harvests ────[source]──── batches

batches (1) ──── (1) sortings ────< (N) sorting_results ──── grades, ponds
                                            │
                                            └─── creates new ────> batches (parent_batch_id)
```

## Detail Field Penting

### `purchases` (Pembelian Borong)
- `total_count` (ekor) + `subtotal` (Rp) — **TIDAK ada harga per ekor**
- `avg_price_per_fish` adalah computed column (`subtotal / total_count`)
- Status: `pending` → `received` → `sorted`

### `batches` (Inti dari sistem stok)
- Polymorphic source: `source_type` ∈ {`purchase`, `harvest`, `sorting`}
- `parent_batch_id` → batch hasil sortir refer ke batch borong asalnya
- `current_count` di-decrement saat: penjualan, mati, sortir
- `price_per_fish`:
  - **NULL** untuk batch dari `purchase`/`harvest` (belum disortir)
  - **TERISI** untuk batch hasil `sorting` (sudah punya harga per ekor)

### `sortings` + `sorting_results` (Proses Sortir)
- 1 sortir → membagi 1 batch source jadi N batches hasil (per grade × kolam target)
- Saat `status=completed`: `sorting_results` membuat `batches` baru dengan `source_type='sorting'`, `parent_batch_id` = source batch
- `total_loss` = selisih `source.initial_count - SUM(results.count)` (mati saat sortir)

### `stock_movements` (Audit Trail)
Setiap perubahan stok wajib tercatat:
| `type` | Trigger |
|---|---|
| `in` | Pembelian / panen masuk |
| `sort_out` | Batch source dikurangi saat sortir |
| `sort_in` | Batch baru dibuat dari sortir |
| `transfer` | Mutasi antar kolam |
| `out` | Penjualan |
| `death` | Kematian |
| `adjustment` | Stock opname / koreksi manual |

## Diagram Visual (textual)

```
┌──────────────┐  ┌────────────────┐  ┌──────────────┐
│  locations   │  │ pond_categories│  │  fish_types  │
└──────┬───────┘  └────────┬───────┘  └──────┬───────┘
       │                   │                  │
       └─────────┬─────────┘                  │
                 │                            │
            ┌────▼────┐                       │
            │  ponds  │                       │
            └────┬────┘                       │
                 │                            │
   ┌─────────────┼────────────────────────────┤
   │             │                            │
┌──▼────────┐ ┌──▼─────┐  ┌────────┐          │
│ harvests  │ │ batches│◄─┤ grades │          │
└───────────┘ └───┬────┘  └────────┘          │
                  │   ▲                       │
   ┌──────────────┤   └───────────────────────┘
   │              │
┌──▼─────┐  ┌────▼─────┐  ┌──────────┐
│purchase│  │ sortings ├──► sorting_ │
└────┬───┘  └──────────┘  │ results  │
     │                    └──────────┘
┌────▼────┐
│suppliers│
└─────────┘

┌────────────────┐  ┌─────────────┐
│ stock_movements│  │ mortalities │
└────────────────┘  └─────────────┘

┌────────┐  ┌────────────┐  ┌────────────────┐
│ sales  ├──►  sale_items├──►    batches    │
└────┬───┘  └────────────┘  └────────────────┘
     │
┌────▼─────────┐
│sales_channels│
└──────────────┘
```

## Aturan Bisnis (di-encode di service layer)

1. **Pembelian borong** membuat 1 `batch` dengan `grade_id = NULL` & `price_per_fish = NULL` di kolam staging.
2. **Saat sortir di-complete**:
   - `source_batch.current_count -= total_sorted + total_loss`
   - `source_batch.status = 'depleted'` jika `current_count = 0`
   - Untuk setiap `sorting_result` → buat `batch` baru dengan `parent_batch_id`, `grade_id`, `price_per_fish`
3. **Penjualan** mengurangi `batch.current_count`. Tidak boleh menjual batch yang `grade_id = NULL` (harus disortir dulu).
4. **Mutasi antar kolam** = update `batch.pond_id` + log `stock_movement` type=`transfer`.
5. **Kolam tanah panen** → membuat `harvest` → di-sortir dengan flow yang sama dengan pembelian.
