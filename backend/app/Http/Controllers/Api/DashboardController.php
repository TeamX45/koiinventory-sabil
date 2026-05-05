<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\Pond;
use App\Models\Purchase;
use App\Models\Sale;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

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

            return [
                'total_active_stock'   => $totalActiveStock,
                'unsorted_stock'       => $unsortedStock,
                'purchase_this_month'  => ['count' => $purchaseCount, 'total' => $purchaseThisMonth],
                'sale_this_month'      => ['count' => $saleCount,     'total' => $saleThisMonth],
                'stock_by_location'    => $stockByLocation,
                'stock_by_grade'       => $stockByGrade,
            ];
        });

        return response()->json(['data' => $payload]);
    }
}
