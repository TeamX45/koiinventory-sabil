<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Services\SortingService;
use App\Support\PaginatesResponse;
use Illuminate\Http\Request;

class BatchController extends Controller
{
    use PaginatesResponse;

    public function __construct(private SortingService $service) {}

    public function index(Request $request)
    {
        $query = Batch::with(['pond.location', 'grade', 'fishType']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        } else {
            $query->where('status', 'active');
        }

        if ($request->filled('pond_id')) {
            $query->where('pond_id', $request->pond_id);
        }
        if ($request->filled('grade_id')) {
            $query->where('grade_id', $request->grade_id);
        }
        if ($request->boolean('unsorted')) {
            $query->whereNull('grade_id');
        }

        $query->latest('id');

        return response()->json($this->paginated($query, $request, defaultPerPage: 50));
    }

    public function show(Batch $batch)
    {
        $batch->load(['pond.location', 'grade', 'fishType', 'parent', 'movements']);
        return response()->json(['data' => $batch]);
    }

    public function transfer(Request $request, Batch $batch)
    {
        $data = $request->validate([
            'to_pond_id' => 'required|exists:ponds,id|different:pond_id',
            'count'      => 'required|integer|min:1',
            'notes'      => 'nullable|string',
        ]);

        try {
            $this->service->transfer($batch, $data['to_pond_id'], $data['count'], $data['notes'] ?? null);
            return response()->json(['data' => $batch->fresh()]);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }
}
