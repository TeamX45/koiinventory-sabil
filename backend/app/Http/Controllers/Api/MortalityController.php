<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\Mortality;
use App\Models\StockMovement;
use App\Support\PaginatesResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class MortalityController extends Controller
{
    use PaginatesResponse;

    public function index(Request $request)
    {
        $query = Mortality::with(['batch.pond.location', 'batch.grade', 'batch.fishType']);

        if ($request->filled('batch_id')) {
            $query->where('batch_id', $request->batch_id);
        }
        if ($request->filled('pond_id')) {
            $query->whereHas('batch', fn ($q) => $q->where('pond_id', $request->pond_id));
        }
        if ($request->filled('cause')) {
            $query->where('cause', 'like', '%' . $request->cause . '%');
        }
        if ($request->filled('from')) {
            $query->where('mortality_date', '>=', $request->from);
        }
        if ($request->filled('to')) {
            $query->where('mortality_date', '<=', $request->to);
        }

        $query->orderByDesc('mortality_date')->orderByDesc('id');

        return response()->json($this->paginated($query, $request));
    }

    public function summary(Request $request)
    {
        $monthStart = Carbon::now()->startOfMonth();
        $weekStart  = Carbon::now()->startOfWeek();

        $totalThisMonth = (int) Mortality::where('mortality_date', '>=', $monthStart)->sum('count');
        $totalThisWeek  = (int) Mortality::where('mortality_date', '>=', $weekStart)->sum('count');
        $totalAllTime   = (int) Mortality::sum('count');

        // Top causes
        $byCause = Mortality::selectRaw('COALESCE(cause, "Tidak diketahui") AS cause, SUM(count) AS total')
            ->where('mortality_date', '>=', $monthStart)
            ->groupBy('cause')
            ->orderByDesc('total')
            ->limit(5)
            ->get();

        // By pond
        $byPond = Mortality::selectRaw('batches.pond_id, ponds.code AS pond_code, ponds.name AS pond_name, SUM(mortalities.count) AS total')
            ->join('batches', 'mortalities.batch_id', '=', 'batches.id')
            ->join('ponds', 'batches.pond_id', '=', 'ponds.id')
            ->where('mortalities.mortality_date', '>=', $monthStart)
            ->groupBy('batches.pond_id', 'ponds.code', 'ponds.name')
            ->orderByDesc('total')
            ->limit(5)
            ->get();

        // Trend per hari (14 hari terakhir)
        $start = Carbon::now()->subDays(13)->startOfDay();
        $byDay = Mortality::selectRaw('DATE(mortality_date) AS date, SUM(count) AS total')
            ->where('mortality_date', '>=', $start)
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->keyBy('date');

        $trend = [];
        for ($i = 13; $i >= 0; $i--) {
            $d = Carbon::now()->subDays($i)->toDateString();
            $trend[] = [
                'date'  => $d,
                'total' => (int) ($byDay[$d]->total ?? 0),
            ];
        }

        return response()->json([
            'data' => [
                'total_this_month' => $totalThisMonth,
                'total_this_week'  => $totalThisWeek,
                'total_all_time'   => $totalAllTime,
                'top_causes'       => $byCause,
                'top_ponds'        => $byPond,
                'trend_14_days'    => $trend,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'batch_id'        => 'required|exists:batches,id',
            'mortality_date'  => 'required|date',
            'count'           => 'required|integer|min:1',
            'cause'           => 'nullable|string|max:100',
            'notes'           => 'nullable|string',
        ]);

        $mortality = DB::transaction(function () use ($data, $request) {
            $batch = Batch::lockForUpdate()->findOrFail($data['batch_id']);
            if ($data['count'] > $batch->current_count) {
                throw new \RuntimeException('Jumlah mati melebihi stok batch.');
            }

            $mortality = Mortality::create([
                ...$data,
                'created_by' => optional($request->user())->id,
            ]);

            $batch->decrement('current_count', $data['count']);
            if ($batch->fresh()->current_count <= 0) {
                $batch->update(['status' => 'depleted']);
            }

            StockMovement::create([
                'batch_id'       => $batch->id,
                'type'           => 'death',
                'from_pond_id'   => $batch->pond_id,
                'to_pond_id'     => null,
                'count'          => -$data['count'],
                'reference_type' => 'Mortality',
                'reference_id'   => $mortality->id,
                'movement_date'  => $data['mortality_date'],
                'notes'          => $data['cause'] ?? null,
                'created_by'     => optional($request->user())->id,
            ]);

            return $mortality->load(['batch.pond.location', 'batch.grade']);
        });

        return response()->json(['data' => $mortality], 201);
    }

    public function update(Request $request, Mortality $mortality)
    {
        $data = $request->validate([
            'mortality_date' => 'sometimes|date',
            'cause'          => 'nullable|string|max:100',
            'notes'          => 'nullable|string',
        ]);

        $mortality->update($data);

        return response()->json([
            'data' => $mortality->fresh(['batch.pond.location', 'batch.grade']),
        ]);
    }

    public function destroy(Mortality $mortality)
    {
        DB::transaction(function () use ($mortality) {
            $batch = Batch::lockForUpdate()->find($mortality->batch_id);
            if ($batch) {
                $batch->increment('current_count', $mortality->count);
                if ($batch->status === 'depleted' && $batch->fresh()->current_count > 0) {
                    $batch->update(['status' => 'active']);
                }

                StockMovement::create([
                    'batch_id'       => $batch->id,
                    'type'           => 'adjustment',
                    'from_pond_id'   => null,
                    'to_pond_id'     => $batch->pond_id,
                    'count'          => $mortality->count,
                    'reference_type' => 'Mortality',
                    'reference_id'   => $mortality->id,
                    'movement_date'  => now()->toDateString(),
                    'notes'          => "Hapus catatan kematian (rollback {$mortality->count} ekor)",
                    'created_by'     => optional(request()->user())->id,
                ]);
            }

            // Hapus stock movement asli (death) supaya audit konsisten
            StockMovement::where('reference_type', 'Mortality')
                ->where('reference_id', $mortality->id)
                ->where('type', 'death')
                ->delete();

            $mortality->delete();
        });

        return response()->json(['message' => 'Mortality deleted'], 200);
    }
}
