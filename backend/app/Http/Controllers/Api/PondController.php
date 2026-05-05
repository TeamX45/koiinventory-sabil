<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\Pond;
use App\Support\GeneratesCode;
use Illuminate\Http\Request;

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
            'location_id'         => 'required|exists:locations,id',
            'pond_category_id'    => 'required|exists:pond_categories,id',
            'code'                => 'sometimes|string|max:30|unique:ponds,code',
            'name'                => 'required|string|max:100',
            'capacity'            => 'nullable|integer|min:1',
            'target_min_size_cm'  => 'nullable|integer|min:1',
            'target_max_size_cm'  => 'nullable|integer|min:1',
            'grow_duration_months'=> 'nullable|integer|min:1',
            'is_active'           => 'boolean',
            'notes'               => 'nullable|string',
        ]);

        if (empty($data['code'])) {
            $data['code'] = $this->retryOnDuplicateCode(
                fn () => $this->generateCode(Pond::class, 'KLM'),
            );
        }

        $pond = Pond::create($data);
        return response()->json(['data' => $pond], 201);
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
