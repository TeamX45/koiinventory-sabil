<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\Harvest;
use App\Models\StockMovement;
use App\Support\GeneratesCode;
use App\Support\PaginatesResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class HarvestController extends Controller
{
    use GeneratesCode, PaginatesResponse;

    public function index(Request $request)
    {
        $query = Harvest::with('sourcePond')
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->when($request->filled('source_pond_id'), fn ($q) => $q->where('source_pond_id', $request->source_pond_id))
            ->when($request->filled('from'), fn ($q) => $q->where('harvest_date', '>=', $request->from))
            ->when($request->filled('to'), fn ($q) => $q->where('harvest_date', '<=', $request->to))
            ->latest('harvest_date')
            ->latest('id');

        return response()->json($this->paginated($query, $request));
    }

    public function show(Harvest $harvest)
    {
        return response()->json(['data' => $harvest->load('sourcePond')]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'source_pond_id' => 'required|exists:ponds,id',
            'harvest_date'   => 'required|date',
            'total_count'    => 'required|integer|min:1',
            'notes'          => 'nullable|string',
        ]);

        $data['status']     = 'pending';
        $data['created_by'] = optional($request->user())->id;

        $harvest = $this->retryOnDuplicateCode(function () use ($data) {
            $data['code'] = $this->generateCode(Harvest::class, 'HRV');
            return Harvest::create($data);
        });

        return response()->json(['data' => $harvest], 201);
    }

    public function update(Request $request, Harvest $harvest)
    {
        if ($harvest->status !== 'pending') {
            return response()->json(['message' => 'Hanya harvest pending yang bisa diubah.'], 422);
        }
        $data = $request->validate([
            'harvest_date' => 'sometimes|date',
            'total_count'  => 'sometimes|integer|min:1',
            'notes'        => 'nullable|string',
        ]);
        $harvest->update($data);
        return response()->json(['data' => $harvest]);
    }

    public function destroy(Harvest $harvest)
    {
        if ($harvest->status !== 'pending') {
            return response()->json(['message' => 'Tidak bisa hapus harvest yang sudah di-sortir.'], 422);
        }
        $harvest->delete();
        return response()->json(null, 204);
    }

    /**
     * Tandai harvest sudah masuk → buat batch awal di pond staging.
     */
    public function receive(Request $request, Harvest $harvest)
    {
        $data = $request->validate([
            'staging_pond_id' => 'required|exists:ponds,id',
            'notes'           => 'nullable|string',
        ]);

        if ($harvest->status !== 'pending') {
            return response()->json(['message' => 'Harvest bukan pending.'], 422);
        }

        $batch = DB::transaction(function () use ($harvest, $data) {
            $batch = Batch::create([
                'code'           => $this->generateCode(Batch::class, 'BTC'),
                'source_type'    => 'harvest',
                'source_id'      => $harvest->id,
                'pond_id'        => $data['staging_pond_id'],
                'initial_count'  => $harvest->total_count,
                'current_count'  => $harvest->total_count,
                'price_per_fish' => null,
                'entry_date'     => $harvest->harvest_date,
                'status'         => 'active',
                'notes'          => $data['notes'] ?? null,
            ]);

            StockMovement::create([
                'batch_id'       => $batch->id,
                'type'           => 'in',
                'from_pond_id'   => $harvest->source_pond_id,
                'to_pond_id'     => $data['staging_pond_id'],
                'count'          => $harvest->total_count,
                'reference_type' => 'Harvest',
                'reference_id'   => $harvest->id,
                'movement_date'  => $harvest->harvest_date,
                'created_by'     => $harvest->created_by,
            ]);

            $harvest->update(['status' => 'harvested']);

            return $batch;
        });

        return response()->json(['data' => $batch]);
    }

}
