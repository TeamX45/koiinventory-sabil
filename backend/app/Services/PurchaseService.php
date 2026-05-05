<?php

namespace App\Services;

use App\Models\Batch;
use App\Models\Pond;
use App\Models\Purchase;
use App\Models\StockMovement;
use App\Support\GeneratesCode;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class PurchaseService
{
    use GeneratesCode;

    /**
     * Tandai purchase sebagai received & buat batch awal (belum ada grade & harga per ekor).
     */
    public function receive(Purchase $purchase, int $pondId, ?string $notes = null): Batch
    {
        if ($purchase->status !== 'pending') {
            throw new InvalidArgumentException("Purchase {$purchase->code} bukan berstatus pending.");
        }

        $pond = Pond::findOrFail($pondId);

        return $this->retryOnDuplicateCode(fn () => DB::transaction(function () use ($purchase, $pond, $notes) {
            $batch = Batch::create([
                'code'           => $this->generateCode(Batch::class, 'BTC'),
                'source_type'    => 'purchase',
                'source_id'      => $purchase->id,
                'pond_id'        => $pond->id,
                'fish_type_id'   => null,
                'grade_id'       => null,
                'initial_count'  => $purchase->total_count,
                'current_count'  => $purchase->total_count,
                'price_per_fish' => null,
                'entry_date'     => $purchase->purchase_date,
                'status'         => 'active',
                'notes'          => $notes,
            ]);

            StockMovement::create([
                'batch_id'       => $batch->id,
                'type'           => 'in',
                'from_pond_id'   => null,
                'to_pond_id'     => $pond->id,
                'count'          => $purchase->total_count,
                'reference_type' => 'Purchase',
                'reference_id'   => $purchase->id,
                'movement_date'  => $purchase->purchase_date,
                'created_by'     => $purchase->created_by,
            ]);

            $purchase->update(['status' => 'received']);

            return $batch;
        }));
    }
}
