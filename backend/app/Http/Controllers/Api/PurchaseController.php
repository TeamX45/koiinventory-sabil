<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Purchase;
use App\Services\PurchaseService;
use App\Support\GeneratesCode;
use App\Support\PaginatesResponse;
use Illuminate\Http\Request;

class PurchaseController extends Controller
{
    use GeneratesCode, PaginatesResponse;

    public function __construct(private PurchaseService $service) {}

    public function index(Request $request)
    {
        $query = Purchase::with('supplier')
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->when($request->filled('supplier_id'), fn ($q) => $q->where('supplier_id', $request->supplier_id))
            ->when($request->filled('from'), fn ($q) => $q->where('purchase_date', '>=', $request->from))
            ->when($request->filled('to'), fn ($q) => $q->where('purchase_date', '<=', $request->to))
            ->latest('purchase_date')
            ->latest('id');

        return response()->json($this->paginated($query, $request));
    }

    public function show(Purchase $purchase)
    {
        $purchase->load('supplier');
        return response()->json(['data' => $purchase]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'supplier_id'   => 'required|exists:suppliers,id',
            'purchase_date' => 'required|date',
            'total_count'   => 'required|integer|min:1',
            'subtotal'      => 'required|numeric|min:0',
            'notes'         => 'nullable|string',
        ]);

        $data['status']     = 'pending';
        $data['created_by'] = optional($request->user())->id;

        $purchase = $this->retryOnDuplicateCode(function () use ($data) {
            $data['code'] = $this->generateCode(Purchase::class, 'PO');
            return Purchase::create($data);
        });

        return response()->json(['data' => $purchase->load('supplier')], 201);
    }

    public function update(Request $request, Purchase $purchase)
    {
        if ($purchase->status !== 'pending') {
            return response()->json(['message' => 'Hanya purchase pending yang bisa diubah.'], 422);
        }

        $data = $request->validate([
            'supplier_id'   => 'sometimes|exists:suppliers,id',
            'purchase_date' => 'sometimes|date',
            'total_count'   => 'sometimes|integer|min:1',
            'subtotal'      => 'sometimes|numeric|min:0',
            'notes'         => 'nullable|string',
        ]);

        $purchase->update($data);
        return response()->json(['data' => $purchase->load('supplier')]);
    }

    public function destroy(Purchase $purchase)
    {
        if ($purchase->status !== 'pending') {
            return response()->json(['message' => 'Tidak bisa menghapus purchase yang sudah received/sorted.'], 422);
        }
        $purchase->delete();
        return response()->json(null, 204);
    }

    public function receive(Request $request, Purchase $purchase)
    {
        $data = $request->validate([
            'pond_id' => 'required|exists:ponds,id',
            'notes'   => 'nullable|string',
        ]);

        try {
            $batch = $this->service->receive($purchase, $data['pond_id'], $data['notes'] ?? null);
            return response()->json(['data' => $batch]);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

}
