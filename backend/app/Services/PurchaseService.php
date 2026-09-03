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
     * Terima barang: pecah satu PO ke satu atau beberapa kolam sekaligus.
     *
     * Pembelian borong jarang masuk ke satu kolam. Dari 20 ekor bisa 5 ke
     * kolam A, 10 ke B, 5 ke C — masing-masing dengan jenis dan rentang ukuran
     * sendiri. Tiap alokasi jadi satu batch, jadi stok tiap kolam langsung
     * benar tanpa perlu transfer manual sesudahnya.
     *
     * Harga per ekor sengaja dibiarkan kosong: harga jual baru ditentukan saat
     * sortir, dan mengisinya dengan harga beli akan mengubah arti angka
     * valuasi di beranda.
     *
     * @param  list<array{pond_id:int,count:int,fish_type_id?:int|null,grade_id?:int|null,size_cm?:int|null,size_max_cm?:int|null}>  $allocations
     * @return list<Batch>
     */
    public function receive(Purchase $purchase, array $allocations, ?string $notes = null): array
    {
        if ($purchase->status !== 'pending') {
            throw new InvalidArgumentException("Purchase {$purchase->code} bukan berstatus pending.");
        }

        if ($allocations === []) {
            throw new InvalidArgumentException('Tentukan minimal satu kolam tujuan.');
        }

        $total = array_sum(array_map(fn ($a) => (int) $a['count'], $allocations));

        if ($total !== (int) $purchase->total_count) {
            $selisih = (int) $purchase->total_count - $total;
            throw new InvalidArgumentException(
                $selisih > 0
                    ? "Baru {$total} dari {$purchase->total_count} ekor yang ditempatkan. Sisa {$selisih} ekor belum punya kolam."
                    : "Total alokasi {$total} ekor melebihi isi PO yang {$purchase->total_count} ekor."
            );
        }

        // Kolam divalidasi lebih dulu supaya tidak ada batch yang terlanjur
        // dibuat kalau salah satu kolamnya ternyata tidak ada.
        foreach ($allocations as $allocation) {
            Pond::findOrFail($allocation['pond_id']);
        }

        return $this->retryOnDuplicateCode(fn () => DB::transaction(function () use ($purchase, $allocations, $notes) {
            $batches = [];

            foreach ($allocations as $allocation) {
                $count = (int) $allocation['count'];

                $batch = Batch::create([
                    'code'           => $this->generateCode(Batch::class, 'BTC'),
                    'source_type'    => 'purchase',
                    'source_id'      => $purchase->id,
                    'pond_id'        => $allocation['pond_id'],
                    'fish_type_id'   => $allocation['fish_type_id'] ?? null,
                    'grade_id'       => $allocation['grade_id'] ?? null,
                    'initial_count'  => $count,
                    'current_count'  => $count,
                    'size_cm'        => $allocation['size_cm'] ?? null,
                    'size_max_cm'    => $allocation['size_max_cm'] ?? null,
                    'price_per_fish' => null,
                    'entry_date'     => $purchase->purchase_date,
                    'status'         => 'active',
                    'notes'          => $notes,
                ]);

                StockMovement::create([
                    'batch_id'       => $batch->id,
                    'type'           => 'in',
                    'from_pond_id'   => null,
                    'to_pond_id'     => $allocation['pond_id'],
                    'count'          => $count,
                    'reference_type' => 'Purchase',
                    'reference_id'   => $purchase->id,
                    'movement_date'  => $purchase->purchase_date,
                    'notes'          => count($allocations) > 1
                        ? "Terima {$purchase->code}: {$count} dari {$purchase->total_count} ekor"
                        : null,
                    'created_by'     => $purchase->created_by,
                ]);

                $batches[] = $batch;
            }

            $purchase->update(['status' => 'received']);

            return $batches;
        }));
    }
}
