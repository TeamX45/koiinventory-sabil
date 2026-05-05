<?php

namespace App\Services;

use App\Models\Batch;
use App\Models\Sorting;
use App\Models\StockMovement;
use App\Support\GeneratesCode;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class SortingService
{
    use GeneratesCode;

    /**
     * Selesaikan sortir: pecah batch source jadi N batch baru per grade × kolam target,
     * dengan harga per ekor. Kurangi stok source. Catat semua di stock_movements.
     */
    public function complete(Sorting $sorting): Sorting
    {
        if ($sorting->status !== 'draft') {
            throw new RuntimeException("Sorting {$sorting->code} sudah {$sorting->status}.");
        }

        $sorting->loadMissing(['sourceBatch', 'results']);
        $source = $sorting->sourceBatch;

        if (!$source || $source->status !== 'active') {
            throw new RuntimeException("Source batch tidak aktif.");
        }

        $totalSorted = (int) $sorting->results->sum('count');
        if ($totalSorted <= 0) {
            throw new RuntimeException('Tidak ada hasil sortir. Tambahkan results dulu.');
        }
        if ($totalSorted > $source->current_count) {
            throw new RuntimeException(
                "Total hasil sortir ({$totalSorted}) melebihi stok source ({$source->current_count})."
            );
        }

        return $this->retryOnDuplicateCode(fn () => DB::transaction(function () use ($sorting, $source, $totalSorted) {
            $loss = (int) $sorting->total_loss;

            // Kurangi source batch (sorted + loss)
            $source->decrement('current_count', $totalSorted + $loss);
            if ($source->fresh()->current_count <= 0) {
                $source->update(['status' => 'depleted']);
            }

            StockMovement::create([
                'batch_id'       => $source->id,
                'type'           => 'sort_out',
                'from_pond_id'   => $source->pond_id,
                'to_pond_id'     => null,
                'count'          => -($totalSorted + $loss),
                'reference_type' => 'Sorting',
                'reference_id'   => $sorting->id,
                'movement_date'  => $sorting->sorting_date,
                'created_by'     => $sorting->created_by,
                'notes'          => "Sortir {$sorting->code}: -{$totalSorted} sorted, -{$loss} loss",
            ]);

            // Buat batch baru per result
            foreach ($sorting->results as $result) {
                $newBatch = Batch::create([
                    'code'            => $this->generateCode(Batch::class, 'BTC'),
                    'source_type'     => 'sorting',
                    'source_id'       => $sorting->id,
                    'parent_batch_id' => $source->id,
                    'pond_id'         => $result->target_pond_id,
                    'fish_type_id'    => $result->fish_type_id,
                    'grade_id'        => $result->grade_id,
                    'initial_count'   => $result->count,
                    'current_count'   => $result->count,
                    'price_per_fish'  => $result->price_per_fish,
                    'entry_date'      => $sorting->sorting_date,
                    'status'          => 'active',
                ]);

                $result->update(['target_batch_id' => $newBatch->id]);

                StockMovement::create([
                    'batch_id'       => $newBatch->id,
                    'type'           => 'sort_in',
                    'from_pond_id'   => $source->pond_id,
                    'to_pond_id'     => $result->target_pond_id,
                    'count'          => $result->count,
                    'reference_type' => 'Sorting',
                    'reference_id'   => $sorting->id,
                    'movement_date'  => $sorting->sorting_date,
                    'created_by'     => $sorting->created_by,
                ]);
            }

            // Update sorting & flag purchase/harvest jadi 'sorted'
            $sorting->update([
                'status'       => 'completed',
                'total_sorted' => $totalSorted,
            ]);

            $sourceRecord = $source->source();
            if ($sourceRecord && in_array($sourceRecord->status, ['received', 'harvested'])) {
                $sourceRecord->update(['status' => 'sorted']);
            }

            return $sorting->fresh(['results.targetBatch']);
        }));
    }

    public function transfer(Batch $batch, int $toPondId, int $count, ?string $notes = null): void
    {
        if ($batch->status !== 'active') {
            throw new RuntimeException('Batch tidak aktif.');
        }
        if ($count <= 0 || $count > $batch->current_count) {
            throw new RuntimeException('Jumlah transfer tidak valid.');
        }

        $this->retryOnDuplicateCode(fn () => DB::transaction(function () use ($batch, $toPondId, $count, $notes) {
            $fromPond = $batch->pond_id;

            // Strategi sederhana: pindahin semua isi batch ke pond baru jika count = current_count.
            // Kalau partial, split jadi 2 batch.
            if ($count === (int) $batch->current_count) {
                $batch->update(['pond_id' => $toPondId]);
                $movedBatchId = $batch->id;
            } else {
                $newBatch = $batch->replicate(['code']);
                $newBatch->code            = $this->generateCode(Batch::class, 'BTC');
                $newBatch->parent_batch_id = $batch->id;
                $newBatch->pond_id         = $toPondId;
                $newBatch->initial_count   = $count;
                $newBatch->current_count   = $count;
                $newBatch->save();

                $batch->decrement('current_count', $count);
                $movedBatchId = $newBatch->id;
            }

            StockMovement::create([
                'batch_id'       => $movedBatchId,
                'type'           => 'transfer',
                'from_pond_id'   => $fromPond,
                'to_pond_id'     => $toPondId,
                'count'          => $count,
                'reference_type' => 'Batch',
                'reference_id'   => $batch->id,
                'movement_date'  => now()->toDateString(),
                'notes'          => $notes,
            ]);
        }));
    }
}
