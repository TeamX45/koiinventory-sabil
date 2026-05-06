<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\StockMovement;
use App\Services\SortingService;
use App\Support\GeneratesCode;
use App\Support\PaginatesResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BatchController extends Controller
{
    use PaginatesResponse, GeneratesCode;

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

    /**
     * Tambah batch manual ke kolam existing.
     * Dipakai saat user mau menambah baris ikan (jenis/grade/ukuran/harga) di kolam
     * yang sudah ada — tanpa lewat Pembelian/Panen.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'pond_id'        => 'required|exists:ponds,id',
            'fish_type_id'   => 'nullable|exists:fish_types,id',
            'grade_id'       => 'nullable|exists:grades,id',
            'count'          => 'required|integer|min:1',
            'size_cm'        => 'nullable|integer|min:1|max:200',
            'size_max_cm'    => 'nullable|integer|min:1|max:200|gte:size_cm',
            'price_per_fish' => 'nullable|numeric|min:0',
            'notes'          => 'nullable|string|max:255',
        ]);

        $batch = $this->retryOnDuplicateCode(fn () => DB::transaction(function () use ($data, $request) {
            $batch = Batch::create([
                'code'           => $this->generateCode(Batch::class, 'BTC'),
                'source_type'    => 'manual',
                'source_id'      => null,
                'pond_id'        => $data['pond_id'],
                'fish_type_id'   => $data['fish_type_id'] ?? null,
                'grade_id'       => $data['grade_id'] ?? null,
                'initial_count'  => $data['count'],
                'current_count'  => $data['count'],
                'size_cm'        => $data['size_cm'] ?? null,
                'size_max_cm'    => $data['size_max_cm'] ?? null,
                'price_per_fish' => $data['price_per_fish'] ?? null,
                'entry_date'     => now()->toDateString(),
                'status'         => 'active',
                'notes'          => $data['notes'] ?? 'Tambah baris ikan manual',
            ]);

            StockMovement::create([
                'batch_id'       => $batch->id,
                'type'           => 'in',
                'from_pond_id'   => null,
                'to_pond_id'     => $data['pond_id'],
                'count'          => $data['count'],
                'reference_type' => 'Batch',
                'reference_id'   => $batch->id,
                'movement_date'  => now()->toDateString(),
                'notes'          => "Tambah manual: {$data['count']} ekor",
                'created_by'     => optional($request->user())->id,
            ]);

            return $batch;
        }));

        return response()->json([
            'data' => $batch->load(['pond.location', 'grade', 'fishType']),
        ], 201);
    }

    /**
     * Update batch manual (jenis/grade/ukuran/harga/notes).
     * count tidak bisa diubah di sini — pakai Stok Opname.
     */
    public function update(Request $request, Batch $batch)
    {
        $data = $request->validate([
            'fish_type_id'   => 'nullable|exists:fish_types,id',
            'grade_id'       => 'nullable|exists:grades,id',
            'size_cm'        => 'nullable|integer|min:1|max:200',
            'size_max_cm'    => 'nullable|integer|min:1|max:200|gte:size_cm',
            'price_per_fish' => 'nullable|numeric|min:0',
            'notes'          => 'nullable|string|max:500',
        ]);

        $batch->update($data);

        return response()->json([
            'data' => $batch->fresh(['pond.location', 'grade', 'fishType']),
        ]);
    }

    /**
     * Hapus batch. Diizinkan kalau current_count = 0 (depleted) atau
     * source_type = manual (stok awal yang salah input).
     * Untuk batch dari Purchase/Harvest/Sorting, tolak — pakai cancel/rollback masing2.
     */
    public function destroy(Batch $batch)
    {
        if (!in_array($batch->source_type, ['manual', 'opname'])) {
            return response()->json([
                'message' => "Batch {$batch->code} berasal dari {$batch->source_type} — hapus via menu sumbernya, bukan langsung.",
            ], 422);
        }

        DB::transaction(function () use ($batch) {
            StockMovement::where('batch_id', $batch->id)->delete();
            $batch->delete();
        });

        return response()->json(null, 204);
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
