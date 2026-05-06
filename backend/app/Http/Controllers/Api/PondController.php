<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\Pond;
use App\Models\StockMovement;
use App\Support\GeneratesCode;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PondController extends Controller
{
    use GeneratesCode;

    public function index(Request $request)
    {
        $query = Pond::query()
            ->with(['location', 'category'])
            ->withSum(['batches as current_stock' => fn ($q) => $q->where('status', 'active')], 'current_count');

        if ($request->filled('location_id')) {
            $query->where('location_id', $request->location_id);
        }
        if ($request->filled('category_id')) {
            $query->where('pond_category_id', $request->category_id);
        }

        return response()->json(['data' => $query->orderBy('code')->get()]);
    }

    public function show(Pond $pond)
    {
        $pond->load(['location', 'category']);
        $pond->current_stock = $pond->activeBatches()->sum('current_count');

        return response()->json(['data' => $pond]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'location_id'                 => 'required|exists:locations,id',
            'pond_category_id'            => 'required|exists:pond_categories,id',
            'code'                        => 'sometimes|string|max:30|unique:ponds,code',
            'name'                        => 'required|string|max:100',
            'capacity'                    => 'nullable|integer|min:1',
            'target_min_size_cm'          => 'nullable|integer|min:1',
            'target_max_size_cm'          => 'nullable|integer|min:1',
            'grow_duration_months'        => 'nullable|integer|min:1',
            'is_active'                   => 'boolean',
            'notes'                       => 'nullable|string',

            // Multi-batch initial stock (opsional)
            'batches'                     => 'nullable|array',
            'batches.*.fish_type_id'      => 'nullable|exists:fish_types,id',
            'batches.*.grade_id'          => 'nullable|exists:grades,id',
            'batches.*.count'             => 'required_with:batches|integer|min:1',
            'batches.*.size_cm'           => 'nullable|integer|min:1|max:200',
            'batches.*.size_max_cm'       => 'nullable|integer|min:1|max:200|gte:batches.*.size_cm',
            'batches.*.price_per_fish'    => 'nullable|numeric|min:0',
            'batches.*.notes'             => 'nullable|string|max:255',
        ]);

        if (empty($data['code'])) {
            $data['code'] = $this->retryOnDuplicateCode(
                fn () => $this->generateCode(Pond::class, 'KLM'),
            );
        }

        $batches = $data['batches'] ?? [];
        unset($data['batches']);

        $pond = $this->retryOnDuplicateCode(fn () => DB::transaction(function () use ($data, $batches, $request) {
            $pond = Pond::create($data);

            foreach ($batches as $batchData) {
                $count = (int) $batchData['count'];
                if ($count <= 0) continue;

                $batch = Batch::create([
                    'code'           => $this->generateCode(Batch::class, 'BTC'),
                    'source_type'    => 'manual',
                    'source_id'      => null,
                    'pond_id'        => $pond->id,
                    'fish_type_id'   => $batchData['fish_type_id'] ?? null,
                    'grade_id'       => $batchData['grade_id'] ?? null,
                    'initial_count'  => $count,
                    'current_count'  => $count,
                    'size_cm'        => $batchData['size_cm'] ?? null,
                    'size_max_cm'    => $batchData['size_max_cm'] ?? null,
                    'price_per_fish' => $batchData['price_per_fish'] ?? null,
                    'entry_date'     => now()->toDateString(),
                    'status'         => 'active',
                    'notes'          => $batchData['notes'] ?? 'Stok awal saat pembuatan kolam',
                ]);

                StockMovement::create([
                    'batch_id'       => $batch->id,
                    'type'           => 'in',
                    'from_pond_id'   => null,
                    'to_pond_id'     => $pond->id,
                    'count'          => $count,
                    'reference_type' => 'Pond',
                    'reference_id'   => $pond->id,
                    'movement_date'  => now()->toDateString(),
                    'notes'          => "Stok awal kolam {$pond->name}: {$count} ekor",
                    'created_by'     => optional($request->user())->id,
                ]);
            }

            return $pond;
        }));

        return response()->json(['data' => $pond->load(['location', 'category'])], 201);
    }

    public function update(Request $request, Pond $pond)
    {
        $data = $request->validate([
            'name'                => 'sometimes|string|max:100',
            'capacity'            => 'nullable|integer|min:1',
            'target_min_size_cm'  => 'nullable|integer|min:1',
            'target_max_size_cm'  => 'nullable|integer|min:1',
            'grow_duration_months'=> 'nullable|integer|min:1',
            'is_active'           => 'boolean',
            'notes'               => 'nullable|string',
        ]);

        $pond->update($data);
        return response()->json(['data' => $pond]);
    }

    public function destroy(Pond $pond)
    {
        $batchCount = Batch::where('pond_id', $pond->id)->count();
        if ($batchCount > 0) {
            return response()->json([
                'message' => "Kolam {$pond->code} masih punya {$batchCount} batch terkait. Pindahkan/hapus batch dulu, atau nonaktifkan kolam saja.",
            ], 422);
        }

        $pond->delete();
        return response()->json(null, 204);
    }

    public function batches(Pond $pond)
    {
        $batches = Batch::with(['grade', 'fishType'])
            ->where('pond_id', $pond->id)
            ->where('status', 'active')
            ->get();

        return response()->json(['data' => $batches]);
    }
}
