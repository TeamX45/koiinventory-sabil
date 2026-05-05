<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\StockMovement;
use App\Models\StockOpname;
use App\Services\StockOpnameService;
use App\Support\GeneratesCode;
use App\Support\PaginatesResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StockOpnameController extends Controller
{
    use GeneratesCode, PaginatesResponse;

    public function __construct(private StockOpnameService $service) {}

    public function index(Request $request)
    {
        $query = StockOpname::with(['batch.pond.location', 'batch.grade', 'batch.fishType']);

        if ($request->filled('batch_id')) {
            $query->where('batch_id', $request->batch_id);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('from')) {
            $query->where('opname_date', '>=', $request->from);
        }
        if ($request->filled('to')) {
            $query->where('opname_date', '<=', $request->to);
        }

        $query->orderByDesc('opname_date')->orderByDesc('id');

        return response()->json($this->paginated($query, $request));
    }

    public function show(StockOpname $stockOpname)
    {
        return response()->json([
            'data' => $stockOpname->load(['batch.pond.location', 'batch.grade', 'creator']),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'batch_id'      => 'required|exists:batches,id',
            'opname_date'   => 'required|date',
            'actual_count'  => 'required|integer|min:0',
            'notes'         => 'nullable|string',
        ]);

        $opname = $this->retryOnDuplicateCode(fn () => DB::transaction(function () use ($data, $request) {
            $batch = Batch::findOrFail($data['batch_id']);
            $systemCount = (int) $batch->current_count;
            $diff = (int) $data['actual_count'] - $systemCount;

            return StockOpname::create([
                'code'         => $this->generateCode(StockOpname::class, 'SO'),
                'batch_id'     => $data['batch_id'],
                'opname_date'  => $data['opname_date'],
                'system_count' => $systemCount,
                'actual_count' => $data['actual_count'],
                'difference'   => $diff,
                'status'       => 'draft',
                'notes'        => $data['notes'] ?? null,
                'created_by'   => optional($request->user())->id,
            ]);
        }));

        return response()->json([
            'data' => $opname->load(['batch.pond.location', 'batch.grade']),
        ], 201);
    }

    public function update(Request $request, StockOpname $stockOpname)
    {
        if ($stockOpname->status !== 'draft') {
            return response()->json([
                'message' => "Opname {$stockOpname->code} sudah {$stockOpname->status}, tidak bisa diubah.",
            ], 422);
        }

        $data = $request->validate([
            'opname_date'   => 'sometimes|date',
            'actual_count'  => 'sometimes|integer|min:0',
            'notes'         => 'nullable|string',
        ]);

        if (array_key_exists('actual_count', $data)) {
            $diff = (int) $data['actual_count'] - (int) $stockOpname->system_count;
            $data['difference'] = $diff;
        }

        $stockOpname->update($data);

        return response()->json([
            'data' => $stockOpname->fresh(['batch.pond.location', 'batch.grade']),
        ]);
    }

    public function complete(StockOpname $stockOpname)
    {
        $opname = $this->service->complete($stockOpname);
        return response()->json(['data' => $opname]);
    }

    public function destroy(StockOpname $stockOpname)
    {
        if ($stockOpname->status === 'completed') {
            // Rollback: kembalikan batch.current_count + hapus stock movement
            DB::transaction(function () use ($stockOpname) {
                $batch = Batch::lockForUpdate()->find($stockOpname->batch_id);
                if ($batch && $stockOpname->difference !== 0) {
                    $batch->decrement('current_count', $stockOpname->difference);
                    if ($batch->status === 'depleted' && $batch->fresh()->current_count > 0) {
                        $batch->update(['status' => 'active']);
                    } elseif ($batch->fresh()->current_count <= 0 && $batch->status === 'active') {
                        $batch->update(['status' => 'depleted']);
                    }
                }

                StockMovement::where('reference_type', 'StockOpname')
                    ->where('reference_id', $stockOpname->id)
                    ->delete();

                $stockOpname->delete();
            });
        } else {
            $stockOpname->delete();
        }

        return response()->json(null, 204);
    }
}
