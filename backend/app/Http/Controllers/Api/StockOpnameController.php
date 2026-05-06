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
            'batch_id'      => 'sometimes|exists:batches,id',
            'pond_id'       => 'sometimes|exists:ponds,id',
            'opname_date'   => 'required|date',
            'actual_count'  => 'required|integer|min:0',
            'notes'         => 'nullable|string',
        ]);

        if (empty($data['batch_id']) && empty($data['pond_id'])) {
            return response()->json([
                'message' => 'Pilih kolam atau batch dulu sebelum opname.',
            ], 422);
        }

        $opname = $this->retryOnDuplicateCode(fn () => DB::transaction(function () use ($data, $request) {
            // Kalau pond_id diberikan: cari batch aktif di kolam itu, atau buat batch baru (manual)
            if (empty($data['batch_id']) && !empty($data['pond_id'])) {
                $batch = Batch::where('pond_id', $data['pond_id'])
                    ->where('status', 'active')
                    ->orderBy('id')
                    ->first();

                if (!$batch) {
                    // Kolam belum punya batch aktif → buat batch manual sebagai stok awal
                    $batch = Batch::create([
                        'code'           => $this->generateCode(Batch::class, 'BTC'),
                        'source_type'    => 'manual',
                        'source_id'      => null,
                        'pond_id'        => $data['pond_id'],
                        'fish_type_id'   => null,
                        'grade_id'       => null,
                        'initial_count'  => 0,
                        'current_count'  => 0,
                        'price_per_fish' => null,
                        'entry_date'     => $data['opname_date'],
                        'status'         => 'active',
                        'notes'          => 'Batch dibuat otomatis oleh Stok Opname (stok awal)',
                    ]);
                }

                $data['batch_id'] = $batch->id;
            }

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

    /**
     * Bulk opname: 1 transaksi DB untuk N baris (per batch_id) di 1 kolam.
     * Kalau ada 1 baris gagal, semua dibatalkan (atomic).
     *
     * Payload:
     *   {
     *     opname_date: 'YYYY-MM-DD',
     *     notes?: string,
     *     rows: [
     *       { batch_id: int, actual_count: int },
     *       ...
     *     ]
     *   }
     */
    public function storeBulk(Request $request)
    {
        $data = $request->validate([
            'opname_date'         => 'required|date',
            'notes'               => 'nullable|string',
            'rows'                => 'required|array|min:1',
            'rows.*.batch_id'     => 'required|exists:batches,id',
            'rows.*.actual_count' => 'required|integer|min:0',
        ]);

        $created = $this->retryOnDuplicateCode(fn () => DB::transaction(function () use ($data, $request) {
            $items = [];
            foreach ($data['rows'] as $row) {
                $batch = Batch::findOrFail($row['batch_id']);
                $systemCount = (int) $batch->current_count;
                $diff = (int) $row['actual_count'] - $systemCount;

                $items[] = StockOpname::create([
                    'code'         => $this->generateCode(StockOpname::class, 'SO'),
                    'batch_id'     => $batch->id,
                    'opname_date'  => $data['opname_date'],
                    'system_count' => $systemCount,
                    'actual_count' => $row['actual_count'],
                    'difference'   => $diff,
                    'status'       => 'draft',
                    'notes'        => $data['notes'] ?? null,
                    'created_by'   => optional($request->user())->id,
                ]);
            }
            return $items;
        }));

        return response()->json([
            'data'    => $created,
            'message' => count($created) . ' draf opname tersimpan.',
        ], 201);
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
