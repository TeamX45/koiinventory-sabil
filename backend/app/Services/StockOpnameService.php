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

    /** Relasi yang dimuat untuk jawaban API setelah opname selesai. */
    private const WITH = ['batch.pond', 'batch.grade', 'batch.fishType.parent', 'pond', 'fishType', 'grade'];

    /**
     * Selesaikan opname.
     *
     * Dua jalur:
     *  - Baris menempel ke batch  → koreksi: current_count diset ke hitungan
     *    fisik, selisihnya dicatat sebagai adjustment.
     *  - Baris tanpa batch        → temuan fisik: batch baru dibuat di kolam
     *    yang dipilih, jadi ikannya langsung muncul di daftar kolam.
     */
    public function complete(StockOpname $opname): StockOpname
    {
        if ($opname->status !== 'draft') {
            throw new RuntimeException("Opname {$opname->code} sudah {$opname->status}.");
        }

        if ($opname->isNewStock()) {
            return DB::transaction(fn () => $this->completeAsNewStock($opname));
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

            return $opname->fresh(self::WITH);
        });
    }

    /**
     * Temuan fisik: ikan yang ada di kolam tapi belum tercatat sama sekali.
     * Batch-nya sengaja baru dibuat di sini, bukan saat draf disimpan, supaya
     * draf yang batal diselesaikan tidak meninggalkan baris kosong di stok.
     */
    private function completeAsNewStock(StockOpname $opname): StockOpname
    {
        if (! $opname->pond_id) {
            throw new RuntimeException("Opname {$opname->code} tidak punya kolam tujuan.");
        }

        $count = (int) $opname->actual_count;

        $batch = Batch::create([
            'code'           => $this->generateCode(Batch::class, 'BTC'),
            // source_type 'opname' + source_id = id opname adalah penanda bahwa
            // batch ini lahir dari opname; dipakai saat opname dibatalkan.
            'source_type'    => 'opname',
            'source_id'      => $opname->id,
            'pond_id'        => $opname->pond_id,
            'fish_type_id'   => $opname->fish_type_id,
            'grade_id'       => $opname->grade_id,
            'initial_count'  => $count,
            'current_count'  => $count,
            'size_cm'        => $opname->size_cm,
            'price_per_fish' => $opname->price_per_fish,
            'entry_date'     => $opname->opname_date,
            'status'         => $count > 0 ? 'active' : 'depleted',
            'notes'          => "Masuk dari stok opname {$opname->code} (temuan fisik di kolam)",
        ]);

        if ($count > 0) {
            StockMovement::create([
                'batch_id'       => $batch->id,
                'type'           => 'in',
                'from_pond_id'   => null,
                'to_pond_id'     => $batch->pond_id,
                'count'          => $count,
                'reference_type' => 'StockOpname',
                'reference_id'   => $opname->id,
                'movement_date'  => $opname->opname_date,
                'notes'          => "Stok opname {$opname->code}: {$count} ekor ditemukan di kolam dan dicatat sebagai stok baru",
                'created_by'     => $opname->created_by,
            ]);
        }

        $opname->update([
            'batch_id'     => $batch->id,
            'status'       => 'completed',
            'system_count' => 0,
            'difference'   => $count,
        ]);

        return $opname->fresh(self::WITH);
    }
}
