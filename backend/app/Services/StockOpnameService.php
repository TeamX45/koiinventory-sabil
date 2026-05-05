<?php

namespace App\Services;

use App\Models\Batch;
use App\Models\StockMovement;
use App\Models\StockOpname;
use App\Support\GeneratesCode;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class StockOpnameService
{
    use GeneratesCode;

    /**
     * Selesaikan opname: update batch.current_count ke actual_count,
     * catat selisih sebagai stock_movement type=adjustment.
     */
    public function complete(StockOpname $opname): StockOpname
    {
        if ($opname->status !== 'draft') {
            throw new RuntimeException("Opname {$opname->code} sudah {$opname->status}.");
        }

        return DB::transaction(function () use ($opname) {
            $batch = Batch::lockForUpdate()->findOrFail($opname->batch_id);

            // Recompute difference dari stok terkini (mungkin berubah sejak draft dibuat)
            $currentSystem = (int) $batch->current_count;
            $diff = (int) $opname->actual_count - $currentSystem;

            $batch->update(['current_count' => $opname->actual_count]);

            if ($batch->fresh()->current_count <= 0) {
                $batch->update(['status' => 'depleted']);
            } elseif ($batch->status === 'depleted' && $batch->fresh()->current_count > 0) {
                $batch->update(['status' => 'active']);
            }

            // Catat di stock_movements jika ada selisih
            if ($diff !== 0) {
                StockMovement::create([
                    'batch_id'       => $batch->id,
                    'type'           => 'adjustment',
                    'from_pond_id'   => $diff < 0 ? $batch->pond_id : null,
                    'to_pond_id'     => $diff > 0 ? $batch->pond_id : null,
                    'count'          => $diff,
                    'reference_type' => 'StockOpname',
                    'reference_id'   => $opname->id,
                    'movement_date'  => $opname->opname_date,
                    'notes'          => "Stok opname {$opname->code}: sistem {$currentSystem} → fisik {$opname->actual_count}",
                    'created_by'     => $opname->created_by,
                ]);
            }

            $opname->update([
                'status'       => 'completed',
                'system_count' => $currentSystem,
                'difference'   => $diff,
            ]);

            return $opname->fresh(['batch.pond', 'batch.grade']);
        });
    }
}
