<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Sale;
use App\Services\SaleService;
use App\Support\PaginatesResponse;
use Illuminate\Http\Request;

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
            'data' => $sale->load(['channel', 'items.batch.pond', 'items.batch.grade']),
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

    public function destroy(Sale $sale)
    {
        if ($sale->status !== 'draft') {
            return response()->json(['message' => 'Hanya sale draft yang bisa dihapus.'], 422);
        }
        $sale->delete();
        return response()->json(null, 204);
    }

    public function cancel(Sale $sale)
    {
        $sale->update(['status' => 'cancelled']);
        return response()->json(['data' => $sale]);
    }
}
