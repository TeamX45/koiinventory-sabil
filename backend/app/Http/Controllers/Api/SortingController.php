<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Sorting;
use App\Models\SortingResult;
use App\Services\SortingService;
use App\Support\GeneratesCode;
use App\Support\PaginatesResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SortingController extends Controller
{
    use GeneratesCode, PaginatesResponse;

    public function __construct(private SortingService $service) {}

    public function index(Request $request)
    {
        $query = Sorting::with(['sourceBatch.pond', 'results.grade', 'results.targetPond'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->when($request->filled('from'), fn ($q) => $q->where('sorting_date', '>=', $request->from))
            ->when($request->filled('to'), fn ($q) => $q->where('sorting_date', '<=', $request->to))
            ->latest('sorting_date')
            ->latest('id');

        return response()->json($this->paginated($query, $request));
    }

    public function show(Sorting $sorting)
    {
        return response()->json([
            'data' => $sorting->load(['sourceBatch', 'results.grade', 'results.targetPond', 'results.fishType']),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'source_batch_id'         => 'required|exists:batches,id',
            'sorting_date'            => 'required|date',
            'total_loss'              => 'nullable|integer|min:0',
            'notes'                   => 'nullable|string',
            'results'                 => 'required|array|min:1',
            'results.*.grade_id'      => 'required|exists:grades,id',
            'results.*.target_pond_id'=> 'required|exists:ponds,id',
            'results.*.fish_type_id'  => 'nullable|exists:fish_types,id',
            'results.*.count'         => 'required|integer|min:1',
            'results.*.price_per_fish'=> 'required|numeric|min:0',
            'results.*.notes'         => 'nullable|string',
        ]);

        $sorting = $this->retryOnDuplicateCode(function () use ($data, $request) {
            return DB::transaction(function () use ($data, $request) {
                $sorting = Sorting::create([
                    'code'            => $this->generateCode(Sorting::class, 'SRT'),
                    'source_batch_id' => $data['source_batch_id'],
                    'sorting_date'    => $data['sorting_date'],
                    'total_loss'      => $data['total_loss'] ?? 0,
                    'notes'           => $data['notes'] ?? null,
                    'status'          => 'draft',
                    'created_by'      => optional($request->user())->id,
                ]);

                foreach ($data['results'] as $r) {
                    SortingResult::create([
                        'sorting_id'     => $sorting->id,
                        'grade_id'       => $r['grade_id'],
                        'target_pond_id' => $r['target_pond_id'],
                        'fish_type_id'   => $r['fish_type_id'] ?? null,
                        'count'          => $r['count'],
                        'price_per_fish' => $r['price_per_fish'],
                        'notes'          => $r['notes'] ?? null,
                    ]);
                }

                return $sorting->load('results');
            });
        });

        return response()->json(['data' => $sorting], 201);
    }

    public function update(Request $request, Sorting $sorting)
    {
        if ($sorting->status !== 'draft') {
            return response()->json(['message' => 'Hanya sorting draft yang bisa diubah.'], 422);
        }
        $data = $request->validate([
            'sorting_date' => 'sometimes|date',
            'total_loss'   => 'nullable|integer|min:0',
            'notes'        => 'nullable|string',
        ]);
        $sorting->update($data);
        return response()->json(['data' => $sorting->load('results')]);
    }

    public function destroy(Sorting $sorting)
    {
        if ($sorting->status !== 'draft') {
            return response()->json(['message' => 'Tidak bisa hapus sorting yang sudah completed.'], 422);
        }
        $sorting->delete();
        return response()->json(null, 204);
    }

    public function complete(Sorting $sorting)
    {
        try {
            $result = $this->service->complete($sorting);
            return response()->json(['data' => $result]);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

}
