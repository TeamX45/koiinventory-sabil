<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\Sale;
use App\Models\StockMovement;
use App\Services\SaleService;
use App\Support\PaginatesResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SaleController extends Controller
{
    use PaginatesResponse;

    public function __construct(private SaleService $service) {}

    public function index(Request $request)
    {
        $query = Sale::with(['channel', 'items.batch'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->when($request->filled('sales_channel_id'), fn ($q) => $q->where('sales_channel_id', $request->sales_channel_id))
            ->when($request->filled('from'), fn ($q) => $q->where('sale_date', '>=', $request->from))
            ->when($request->filled('to'), fn ($q) => $q->where('sale_date', '<=', $request->to))
            ->latest('sale_date')
            ->latest('id');

        return response()->json($this->paginated($query, $request));
    }

    public function show(Sale $sale)
    {
        return response()->json([
            'data' => $sale->load(['channel', 'items.batch.pond.location', 'items.batch.grade', 'items.batch.fishType']),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'sales_channel_id'            => 'required|exists:sales_channels,id',
            'sale_date'                   => 'required|date',
            'customer_name'               => 'nullable|string|max:150',
            'customer_phone'              => 'nullable|string|max:30',
            'customer_address'            => 'nullable|string',
            'discount'                    => 'nullable|numeric|min:0',
            'shipping_cost'               => 'nullable|numeric|min:0',
            'status'                      => 'nullable|in:draft,paid,shipped,completed,cancelled',
            'notes'                       => 'nullable|string',
            'items'                       => 'required|array|min:1',
            'items.*.batch_id'            => 'required|exists:batches,id',
            'items.*.count'               => 'required|integer|min:1',
            'items.*.price_per_fish'      => 'required|numeric|min:0',
            'items.*.notes'               => 'nullable|string',
        ]);

        $data['created_by'] = optional($request->user())->id;

        try {
            $sale = $this->service->create($data);
            return response()->json(['data' => $sale->load(['channel', 'items'])], 201);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function update(Request $request, Sale $sale)
    {
        $data = $request->validate([
            'status' => 'sometimes|in:draft,paid,shipped,completed,cancelled',
            'notes'  => 'nullable|string',
        ]);
        $sale->update($data);
        return response()->json(['data' => $sale->fresh(['channel', 'items'])]);
    }

    /**
     * Hapus sale + rollback efek-nya:
     * - draft: stok belum dipotong? Sebenarnya store() langsung decrement,
     *   jadi draft pun perlu rollback. Treat sama dgn cancelled.
     * - cancelled: stok sudah dikembalikan, langsung hapus saja.
     * - paid/shipped/completed: tolak (sale yang sudah selesai jangan dihapus,
     *   pakai 'Batalkan' dulu untuk audit trail yg jelas).
     */
    public function destroy(Sale $sale)
    {
        if (in_array($sale->status, ['paid', 'shipped', 'completed'], true)) {
            return response()->json([
                'message' => "Sale {$sale->code} sudah {$sale->status}. Batalkan dulu sebelum hapus.",
            ], 422);
        }

        DB::transaction(function () use ($sale) {
            // Kalau status masih draft, rollback stok dulu (cancel belum dijalankan)
            if ($sale->status === 'draft') {
                $this->restoreStock($sale);
            }

            // Hapus stock_movements + items + sale
            StockMovement::where('reference_type', 'Sale')
                ->where('reference_id', $sale->id)
                ->delete();
            $sale->items()->delete();
            $sale->delete();
        });

        return response()->json(null, 204);
    }

    /**
     * Batalkan sale: kembalikan stok ke tiap batch + hapus stock_movements
     * sale ini, lalu set status=cancelled. Atomic.
     *
     * BUG FIX: sebelumnya hanya update status tanpa restore stok — ikan hilang
     * permanen dari sistem.
     */
    public function cancel(Sale $sale)
    {
        if ($sale->status === 'cancelled') {
            return response()->json([
                'message' => "Sale {$sale->code} sudah dibatalkan.",
            ], 422);
        }

        DB::transaction(function () use ($sale) {
            $this->restoreStock($sale);

            StockMovement::where('reference_type', 'Sale')
                ->where('reference_id', $sale->id)
                ->delete();

            $sale->update(['status' => 'cancelled']);
        });

        return response()->json([
            'data'    => $sale->fresh(['channel', 'items']),
            'message' => 'Sale dibatalkan, stok dikembalikan ke kolam.',
        ]);
    }

    /**
     * Increment kembali batch.current_count untuk tiap item sale.
     * Reactivate batch yang depleted kalau sekarang ada stok lagi.
     */
    private function restoreStock(Sale $sale): void
    {
        foreach ($sale->items as $item) {
            $batch = Batch::lockForUpdate()->find($item->batch_id);
            if (!$batch) continue;

            $batch->increment('current_count', $item->count);

            // Kalau sebelumnya depleted dan sekarang ada stok, kembalikan ke active
            if ($batch->status === 'depleted' && $batch->fresh()->current_count > 0) {
                $batch->update(['status' => 'active']);
            }
        }
    }
}
