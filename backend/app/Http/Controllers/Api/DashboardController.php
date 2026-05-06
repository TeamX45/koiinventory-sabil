<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\Expense;
use App\Models\Pond;
use App\Models\Purchase;
use App\Models\Sale;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    /**
     * Cache 60 detik supaya beban query agregat tidak meledak saat banyak user
     * buka dashboard bareng. Stale data <1 menit dapat diterima utk overview.
     * Cache di-bust otomatis lewat invalidation manual ketika ada perubahan stok besar
     * (sortir complete, sale create, mortality, dll — sudah invalidate dari mutation FE).
     */
    public function summary()
    {
        $payload = Cache::remember('dashboard:summary', now()->addSeconds(60), function () {
            $monthStart = Carbon::now()->startOfMonth();

            $totalActiveStock = (int) Batch::where('status', 'active')->sum('current_count');

            $purchaseThisMonth = (float) Purchase::where('purchase_date', '>=', $monthStart)
                ->where('status', '!=', 'cancelled')->sum('subtotal');
            $purchaseCount = Purchase::where('purchase_date', '>=', $monthStart)
                ->where('status', '!=', 'cancelled')->count();

            $saleThisMonth = (float) Sale::where('sale_date', '>=', $monthStart)
                ->where('status', '!=', 'cancelled')->sum('total');
            $saleCount = Sale::where('sale_date', '>=', $monthStart)
                ->where('status', '!=', 'cancelled')->count();

            $expenseThisMonth = (float) Expense::where('expense_date', '>=', $monthStart)->sum('amount');
            $expenseCount = (int) Expense::where('expense_date', '>=', $monthStart)->count();

            $expenseByCategory = Expense::where('expense_date', '>=', $monthStart)
                ->selectRaw('expense_category_id, SUM(amount) as total')
                ->groupBy('expense_category_id')
                ->orderByDesc('total')
                ->limit(8)
                ->with('category:id,name,icon')
                ->get()
                ->map(fn ($r) => [
                    'category' => optional($r->category)->name ?? '—',
                    'icon'     => optional($r->category)->icon,
                    'total'    => (float) $r->total,
                ]);

            $stockByLocation = Pond::with('location')
                ->select('ponds.id', 'ponds.location_id')
                ->withSum(['batches as stock' => fn ($q) => $q->where('status', 'active')], 'current_count')
                ->get()
                ->groupBy('location.name')
                ->map(fn ($ponds) => $ponds->sum('stock'));

            $stockByGrade = Batch::where('status', 'active')
                ->whereNotNull('grade_id')
                ->selectRaw('grade_id, SUM(current_count) as total')
                ->groupBy('grade_id')
                ->with('grade')
                ->get()
                ->mapWithKeys(fn ($r) => [optional($r->grade)->name ?? 'Unknown' => (int) $r->total]);

            $unsortedStock = (int) Batch::where('status', 'active')
                ->whereNull('grade_id')
                ->sum('current_count');

            // Top 5 jenis ikan by jumlah ekor aktif
            $topFishTypes = Batch::where('status', 'active')
                ->whereNotNull('fish_type_id')
                ->selectRaw('fish_type_id, SUM(current_count) as total, SUM(current_count * COALESCE(price_per_fish,0)) as value')
                ->groupBy('fish_type_id')
                ->orderByDesc('total')
                ->limit(5)
                ->with('fishType:id,name,group')
                ->get()
                ->map(fn ($r) => [
                    'fish_type_id' => $r->fish_type_id,
                    'name'         => optional($r->fishType)->name ?? '—',
                    'group'        => optional($r->fishType)->group ?? '—',
                    'total'        => (int) $r->total,
                    'value'        => (float) $r->value,
                ]);

            // Valuasi (total ekor × harga) per lokasi
            $valuationByLocation = Batch::where('batches.status', 'active')
                ->join('ponds', 'ponds.id', '=', 'batches.pond_id')
                ->join('locations', 'locations.id', '=', 'ponds.location_id')
                ->selectRaw('locations.name as location, SUM(batches.current_count) as ekor, SUM(batches.current_count * COALESCE(batches.price_per_fish,0)) as value')
                ->groupBy('locations.name')
                ->orderByDesc('value')
                ->get()
                ->map(fn ($r) => [
                    'location' => $r->location,
                    'ekor'     => (int) $r->ekor,
                    'value'    => (float) $r->value,
                ]);

            $totalValuation = (float) $valuationByLocation->sum('value');

            // Trend 30 hari: pergerakan masuk-keluar (in/out) dari stock_movements
            $trend30 = DB::table('stock_movements')
                ->selectRaw("DATE(movement_date) as date, type, SUM(count) as total")
                ->where('movement_date', '>=', Carbon::now()->subDays(30)->toDateString())
                ->groupBy('date', 'type')
                ->orderBy('date')
                ->get()
                ->groupBy('date')
                ->map(function ($rows, $date) {
                    $in  = (int) $rows->where('type', 'in')->sum('total');
                    $out = (int) $rows->where('type', 'out')->sum('total');
                    return ['date' => $date, 'in' => $in, 'out' => $out, 'net' => $in - $out];
                })
                ->values();

            // Top 5 kolam berdasarkan jumlah ekor
            $topPonds = Pond::with('location:id,name')
                ->withSum(['batches as stock' => fn ($q) => $q->where('status', 'active')], 'current_count')
                ->orderByDesc('stock')
                ->limit(5)
                ->get(['ponds.id', 'ponds.name', 'ponds.location_id'])
                ->map(fn ($p) => [
                    'id'       => $p->id,
                    'name'     => $p->name,
                    'location' => optional($p->location)->name,
                    'stock'    => (int) ($p->stock ?? 0),
                ]);

            return [
                'total_active_stock'   => $totalActiveStock,
                'unsorted_stock'       => $unsortedStock,
                'total_valuation'      => $totalValuation,
                'purchase_this_month'  => ['count' => $purchaseCount, 'total' => $purchaseThisMonth],
                'sale_this_month'      => ['count' => $saleCount,     'total' => $saleThisMonth],
                'expense_this_month'   => ['count' => $expenseCount,  'total' => $expenseThisMonth],
                'expense_by_category'  => $expenseByCategory,
                'stock_by_location'    => $stockByLocation,
                'stock_by_grade'       => $stockByGrade,
                'top_fish_types'       => $topFishTypes,
                'valuation_by_location' => $valuationByLocation,
                'top_ponds'            => $topPonds,
                'trend_30_days'        => $trend30,
            ];
        });

        return response()->json(['data' => $payload]);
    }
}
