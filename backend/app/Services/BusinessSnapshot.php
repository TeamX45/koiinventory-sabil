<?php

namespace App\Services;

use App\Models\Batch;
use App\Models\Expense;
use App\Models\Mortality;
use App\Models\Pond;
use App\Models\Purchase;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Sorting;
use App\Models\StockOpname;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Potret bisnis dalam bentuk angka — bahan mentah untuk analisis AI.
 *
 * Yang dikirim ke penyedia AI HANYA agregat seperti ini: tidak ada nama
 * pelanggan, nomor telepon, alamat, maupun baris transaksi satuan. Cukup untuk
 * menilai kesehatan usaha, tidak cukup untuk mengenali orang.
 *
 * Ukurannya sengaja dijaga kecil (beberapa KB): daftar dipotong ke beberapa
 * teratas saja, karena kuota gratis dihitung dari token.
 *
 * Semua kueri memakai perbandingan tanggal biasa, bukan fungsi tanggal khas
 * MySQL, supaya hasil di sqlite (test) sama dengan di produksi.
 *
 * Hasilnya WAJIB array biasa sampai ke daun, bukan Collection: potret ini ikut
 * masuk cache, dan cache.serializable_classes bernilai false, jadi objek apa
 * pun kembali sebagai __PHP_Incomplete_Class saat dibaca ulang.
 */
class BusinessSnapshot
{
    /** Panjang jendela analisis, dalam hari. */
    public const WINDOW_DAYS = 30;

    /** Batch yang lebih tua dari ini dianggap mengendap. */
    private const STALE_DAYS = 90;

    /** Berapa baris teratas yang disertakan di tiap daftar. */
    private const TOP_N = 8;

    public function build(): array
    {
        $today      = Carbon::today();
        $windowFrom = $today->copy()->subDays(self::WINDOW_DAYS);
        $monthStart = $today->copy()->startOfMonth();

        $stock = $this->stock($today);
        $buy   = $this->purchases($windowFrom, $today);
        $sell  = $this->sales($windowFrom, $today);

        return [
            'dibuat_pada' => now()->toIso8601String(),
            'periode' => [
                'jendela_hari'  => self::WINDOW_DAYS,
                'dari'          => $windowFrom->toDateString(),
                'sampai'        => $today->toDateString(),
                'awal_bulan_ini' => $monthStart->toDateString(),
            ],
            'stok'                => $stock,
            'kolam'               => $this->ponds(),
            'pembelian'           => $buy,
            'penjualan'           => $sell,
            'penjualan_bulan_ini' => $this->salesThisMonth($monthStart, $today),
            'kematian'            => $this->mortalities($windowFrom, $today, $stock['total_ekor_aktif']),
            'pengeluaran'         => $this->expenses($windowFrom, $today),
            'sortir'              => $this->sortings($windowFrom, $today),
            'opname'              => $this->opnames($windowFrom, $today),
            'margin_kasar'        => $this->grossMargin($buy, $sell),
        ];
    }

    private function stock(Carbon $today): array
    {
        $active = Batch::where('status', 'active');

        $perLocation = Pond::query()
            ->join('locations', 'locations.id', '=', 'ponds.location_id')
            ->leftJoin('batches', function ($join) {
                $join->on('batches.pond_id', '=', 'ponds.id')
                    ->where('batches.status', '=', 'active');
            })
            ->groupBy('locations.id', 'locations.name')
            ->select('locations.name as lokasi')
            ->selectRaw('COALESCE(SUM(batches.current_count), 0) as ekor')
            ->selectRaw('COUNT(DISTINCT ponds.id) as jumlah_kolam')
            ->orderByDesc('ekor')
            ->get()
            ->map(fn ($r) => [
                'lokasi'       => $r->lokasi,
                'ekor'         => (int) $r->ekor,
                'jumlah_kolam' => (int) $r->jumlah_kolam,
            ])
            ->all();

        $perGrade = Batch::query()
            ->where('batches.status', 'active')
            ->leftJoin('grades', 'grades.id', '=', 'batches.grade_id')
            ->groupBy('grades.id', 'grades.name')
            ->select(DB::raw("COALESCE(grades.name, 'Belum digrade') as grade"))
            ->selectRaw('SUM(batches.current_count) as ekor')
            ->orderByDesc('ekor')
            ->get()
            ->map(fn ($r) => ['grade' => $r->grade, 'ekor' => (int) $r->ekor])
            ->all();

        $topTypes = Batch::query()
            ->where('batches.status', 'active')
            ->leftJoin('fish_types', 'fish_types.id', '=', 'batches.fish_type_id')
            ->groupBy('fish_types.id', 'fish_types.name')
            ->select(DB::raw("COALESCE(fish_types.name, 'Tanpa jenis') as jenis"))
            ->selectRaw('SUM(batches.current_count) as ekor')
            ->orderByDesc('ekor')
            ->limit(self::TOP_N)
            ->get()
            ->map(fn ($r) => ['jenis' => $r->jenis, 'ekor' => (int) $r->ekor])
            ->all();

        $unsorted = Batch::where('status', 'active')
            ->whereIn('source_type', ['purchase', 'harvest'])
            ->whereNull('grade_id');

        $stale = Batch::where('status', 'active')
            ->where('entry_date', '<', $today->copy()->subDays(self::STALE_DAYS));

        return [
            'total_ekor_aktif'   => (int) (clone $active)->sum('current_count'),
            'jumlah_batch_aktif' => (int) (clone $active)->count(),
            'per_lokasi'         => $perLocation,
            'per_grade'          => $perGrade,
            'jenis_teratas'      => $topTypes,
            'belum_disortir'     => [
                'batch' => (int) (clone $unsorted)->count(),
                'ekor'  => (int) (clone $unsorted)->sum('current_count'),
            ],
            'mengendap' => [
                'lebih_dari_hari' => self::STALE_DAYS,
                'batch'           => (int) (clone $stale)->count(),
                'ekor'            => (int) (clone $stale)->sum('current_count'),
            ],
        ];
    }

    private function ponds(): array
    {
        $ponds = Pond::query()
            ->where('is_active', true)
            ->withSum(['batches as isi' => fn ($q) => $q->where('status', 'active')], 'current_count')
            ->get();

        $over = $ponds
            ->filter(fn ($p) => $p->capacity && (int) $p->isi > $p->capacity)
            ->sortByDesc(fn ($p) => (int) $p->isi - $p->capacity)
            ->take(5)
            ->map(fn ($p) => [
                'kolam'    => $p->name,
                'kapasitas' => (int) $p->capacity,
                'isi'      => (int) $p->isi,
                'kelebihan' => (int) $p->isi - (int) $p->capacity,
            ])
            ->values()
            ->all();

        return [
            'jumlah_aktif'        => $ponds->count(),
            'kosong'              => $ponds->filter(fn ($p) => (int) $p->isi === 0)->count(),
            'melebihi_kapasitas'  => $over,
        ];
    }

    private function purchases(Carbon $from, Carbon $to): array
    {
        $base = Purchase::whereBetween('purchase_date', [$from, $to])
            ->where('status', '!=', 'cancelled');

        $count = (int) (clone $base)->count();
        $fish  = (int) (clone $base)->sum('total_count');
        $rp    = (float) (clone $base)->sum('subtotal');

        $topSuppliers = (clone $base)
            ->join('suppliers', 'suppliers.id', '=', 'purchases.supplier_id')
            ->groupBy('suppliers.id', 'suppliers.name')
            ->select('suppliers.name as pemasok')
            ->selectRaw('COUNT(*) as jumlah_po')
            ->selectRaw('SUM(purchases.subtotal) as rupiah')
            ->orderByDesc('rupiah')
            ->limit(5)
            ->get()
            ->map(fn ($r) => [
                'pemasok'   => $r->pemasok,
                'jumlah_po' => (int) $r->jumlah_po,
                'rupiah'    => (float) $r->rupiah,
            ])
            ->all();

        return [
            'jumlah_po'             => $count,
            'total_ekor'            => $fish,
            'total_rupiah'          => $rp,
            'rata_harga_per_ekor'   => $fish > 0 ? round($rp / $fish, 2) : null,
            'po_belum_diterima'     => (int) Purchase::where('status', 'pending')->count(),
            'pemasok_teratas'       => $topSuppliers,
        ];
    }

    private function sales(Carbon $from, Carbon $to): array
    {
        $base = Sale::whereBetween('sale_date', [$from, $to])
            ->where('status', '!=', 'cancelled');

        $trx      = (int) (clone $base)->count();
        $omzet    = (float) (clone $base)->sum('total');
        $diskon   = (float) (clone $base)->sum('discount');
        $ongkir   = (float) (clone $base)->sum('shipping_cost');

        $items = SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->whereBetween('sales.sale_date', [$from, $to])
            ->where('sales.status', '!=', 'cancelled');

        $fish     = (int) (clone $items)->sum('sale_items.count');
        $itemRp   = (float) (clone $items)->sum('sale_items.subtotal');

        $perChannel = (clone $base)
            ->join('sales_channels', 'sales_channels.id', '=', 'sales.sales_channel_id')
            ->groupBy('sales_channels.id', 'sales_channels.name')
            ->select('sales_channels.name as saluran')
            ->selectRaw('COUNT(*) as transaksi')
            ->selectRaw('SUM(sales.total) as omzet')
            ->orderByDesc('omzet')
            ->get()
            ->map(fn ($r) => [
                'saluran'   => $r->saluran,
                'transaksi' => (int) $r->transaksi,
                'omzet'     => (float) $r->omzet,
            ])
            ->all();

        return [
            'jumlah_transaksi'      => $trx,
            'total_ekor'            => $fish,
            'omzet'                 => $omzet,
            'total_diskon'          => $diskon,
            'total_ongkir'          => $ongkir,
            'rata_harga_jual_per_ekor' => $fish > 0 ? round($itemRp / $fish, 2) : null,
            'per_saluran'           => $perChannel,
            'jenis_terlaris'        => $this->bestSellingTypes($items),
        ];
    }

    /**
     * Jenis ikan terlaris. Item bebas (tanpa batch) hanya punya fish_name,
     * jadi dua agregat digabung di PHP supaya keduanya ikut terhitung.
     */
    private function bestSellingTypes($items): array
    {
        $byType = (clone $items)
            ->join('fish_types', 'fish_types.id', '=', 'sale_items.fish_type_id')
            ->groupBy('fish_types.id', 'fish_types.name')
            ->select('fish_types.name as jenis')
            ->selectRaw('SUM(sale_items.count) as ekor')
            ->selectRaw('SUM(sale_items.subtotal) as rupiah')
            ->get();

        $byName = (clone $items)
            ->whereNull('sale_items.fish_type_id')
            ->whereNotNull('sale_items.fish_name')
            ->groupBy('sale_items.fish_name')
            ->select('sale_items.fish_name as jenis')
            ->selectRaw('SUM(sale_items.count) as ekor')
            ->selectRaw('SUM(sale_items.subtotal) as rupiah')
            ->get();

        return $byType->concat($byName)
            ->sortByDesc(fn ($r) => (float) $r->rupiah)
            ->take(self::TOP_N)
            ->map(fn ($r) => [
                'jenis'  => $r->jenis,
                'ekor'   => (int) $r->ekor,
                'rupiah' => (float) $r->rupiah,
            ])
            ->values()
            ->all();
    }

    private function salesThisMonth(Carbon $monthStart, Carbon $today): array
    {
        $base = Sale::whereBetween('sale_date', [$monthStart, $today])
            ->where('status', '!=', 'cancelled');

        return [
            'transaksi' => (int) (clone $base)->count(),
            'omzet'     => (float) (clone $base)->sum('total'),
        ];
    }

    private function mortalities(Carbon $from, Carbon $to, int $activeStock): array
    {
        $base = Mortality::whereBetween('mortality_date', [$from, $to]);
        $total = (int) (clone $base)->sum('count');

        $causes = (clone $base)
            ->groupBy('cause')
            ->select(DB::raw("COALESCE(cause, 'Tidak dicatat') as penyebab"))
            ->selectRaw('SUM(count) as ekor')
            ->orderByDesc('ekor')
            ->limit(5)
            ->get()
            ->map(fn ($r) => ['penyebab' => $r->penyebab, 'ekor' => (int) $r->ekor])
            ->all();

        $perPond = (clone $base)
            ->join('batches', 'batches.id', '=', 'mortalities.batch_id')
            ->join('ponds', 'ponds.id', '=', 'batches.pond_id')
            ->groupBy('ponds.id', 'ponds.name')
            ->select('ponds.name as kolam')
            ->selectRaw('SUM(mortalities.count) as ekor')
            ->orderByDesc('ekor')
            ->limit(5)
            ->get()
            ->map(fn ($r) => ['kolam' => $r->kolam, 'ekor' => (int) $r->ekor])
            ->all();

        return [
            'total_ekor'       => $total,
            'persen_dari_stok' => $activeStock > 0 ? round($total / ($activeStock + $total) * 100, 2) : null,
            'penyebab_teratas' => $causes,
            'kolam_tertinggi'  => $perPond,
        ];
    }

    private function expenses(Carbon $from, Carbon $to): array
    {
        $base = Expense::whereBetween('expense_date', [$from, $to]);

        $perCategory = (clone $base)
            ->join('expense_categories', 'expense_categories.id', '=', 'expenses.expense_category_id')
            ->groupBy('expense_categories.id', 'expense_categories.name')
            ->select('expense_categories.name as kategori')
            ->selectRaw('SUM(expenses.amount) as rupiah')
            ->orderByDesc('rupiah')
            ->limit(self::TOP_N)
            ->get()
            ->map(fn ($r) => ['kategori' => $r->kategori, 'rupiah' => (float) $r->rupiah])
            ->all();

        return [
            'total_rupiah' => (float) (clone $base)->sum('amount'),
            'per_kategori' => $perCategory,
        ];
    }

    private function sortings(Carbon $from, Carbon $to): array
    {
        $base = Sorting::whereBetween('sorting_date', [$from, $to])
            ->where('status', 'completed');

        return [
            'selesai'         => (int) (clone $base)->count(),
            'total_disortir'  => (int) (clone $base)->sum('total_sorted'),
            'total_susut'     => (int) (clone $base)->sum('total_loss'),
        ];
    }

    /**
     * Opname dicatat per batch, jadi yang berguna untuk analisis adalah
     * akumulasinya: seberapa sering dihitung, dan seberapa jauh hitungan fisik
     * meleset dari catatan sistem.
     */
    private function opnames(Carbon $from, Carbon $to): array
    {
        $base = StockOpname::whereBetween('opname_date', [$from, $to])
            ->where('status', 'completed');

        $last = StockOpname::where('status', 'completed')->max('opname_date');

        return [
            'selesai_di_jendela'   => (int) (clone $base)->count(),
            'total_selisih_ekor'   => (int) (clone $base)->sum('difference'),
            'selisih_kurang_ekor'  => (int) (clone $base)->where('difference', '<', 0)->sum('difference'),
            'tanggal_terakhir'     => $last ? (string) $last : null,
        ];
    }

    /**
     * Selisih kasar harga beli vs harga jual per ekor. Bukan laba bersih:
     * pakan, tenaga, dan penyusutan tidak ada di sini.
     */
    private function grossMargin(array $buy, array $sell): array
    {
        $beli = $buy['rata_harga_per_ekor'];
        $jual = $sell['rata_harga_jual_per_ekor'];

        return [
            'catatan'            => 'Perbandingan harga beli vs jual per ekor pada jendela yang sama. Belum dikurangi pakan, tenaga kerja, dan biaya lain.',
            'harga_beli_rata'    => $beli,
            'harga_jual_rata'    => $jual,
            'selisih_per_ekor'   => ($beli && $jual) ? round($jual - $beli, 2) : null,
            'persen'             => ($beli && $jual && $beli > 0) ? round(($jual - $beli) / $beli * 100, 1) : null,
        ];
    }
}
