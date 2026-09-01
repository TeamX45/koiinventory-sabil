<?php

namespace App\Services;

use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\StockMovement;
use App\Models\Batch;
use App\Support\GeneratesCode;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class SaleService
{
    use GeneratesCode;

    /**
     * Buat sale + items + decrement stok batches + log movement.
     *
     * @param array $payload {
     *   sales_channel_id, sale_date, customer_name, customer_phone, customer_address,
     *   discount, shipping_cost, status, notes, created_by,
     *   items: [ { batch_id?, fish_type_id?, fish_name?, count, price_per_fish, notes? } ]
     * }
     *
     * Item dengan batch_id → potong stok batch + log movement (perilaku lama).
     * Item tanpa batch_id (penjualan bebas / jenis ketik manual) → hanya dicatat
     * sebagai baris penjualan, stok inventori TIDAK berubah. Wajib ada
     * fish_type_id atau fish_name supaya item bisa dikenali.
     */
    public function create(array $payload): Sale
    {
        $items = $payload['items'] ?? [];
        if (empty($items)) {
            throw new RuntimeException('Sale harus minimal 1 item.');
        }

        return $this->retryOnDuplicateCode(fn () => DB::transaction(function () use ($payload, $items) {
            $subtotal = 0;
            foreach ($items as $i) {
                $batchId = $i['batch_id'] ?? null;
                if ($batchId) {
                    $batch = Batch::lockForUpdate()->find($batchId);
                    if (!$batch || $batch->status !== 'active') {
                        throw new RuntimeException("Batch {$batchId} tidak aktif.");
                    }
                    if ($batch->grade_id === null || $batch->price_per_fish === null) {
                        throw new RuntimeException("Batch {$batch->code} belum disortir, tidak bisa dijual.");
                    }
                    if ($i['count'] > $batch->current_count) {
                        throw new RuntimeException("Stok batch {$batch->code} tidak cukup ({$batch->current_count}).");
                    }
                } elseif (empty($i['fish_type_id']) && trim((string) ($i['fish_name'] ?? '')) === '') {
                    throw new RuntimeException('Item tanpa stok wajib pilih atau ketik jenis ikan.');
                }
                $subtotal += $i['count'] * $i['price_per_fish'];
            }

            $discount = $payload['discount'] ?? 0;
            $shipping = $payload['shipping_cost'] ?? 0;
            $total    = $subtotal - $discount + $shipping;

            $sale = Sale::create([
                'code'             => $this->generateCode(Sale::class, 'SO'),
                'sales_channel_id' => $payload['sales_channel_id'],
                'sale_date'        => $payload['sale_date'],
                'customer_name'    => $payload['customer_name']    ?? null,
                'customer_phone'   => $payload['customer_phone']   ?? null,
                'customer_address' => $payload['customer_address'] ?? null,
                'subtotal'         => $subtotal,
                'discount'         => $discount,
                'shipping_cost'    => $shipping,
                'total'            => $total,
                'status'           => $payload['status']  ?? 'draft',
                'notes'            => $payload['notes']   ?? null,
                'created_by'       => $payload['created_by'] ?? null,
            ]);

            foreach ($items as $i) {
                $batchId = $i['batch_id'] ?? null;
                $batch   = $batchId ? Batch::find($batchId) : null;

                $itemSubtotal = $i['count'] * $i['price_per_fish'];

                SaleItem::create([
                    'sale_id'        => $sale->id,
                    'batch_id'       => $batch?->id,
                    'fish_type_id'   => $i['fish_type_id'] ?? $batch?->fish_type_id,
                    'fish_name'      => $i['fish_name'] ?? null,
                    'count'          => $i['count'],
                    'price_per_fish' => $i['price_per_fish'],
                    'subtotal'       => $itemSubtotal,
                    'notes'          => $i['notes'] ?? null,
                ]);

                // Item tanpa batch: hanya catatan penjualan, stok tidak disentuh
                if (!$batch) {
                    continue;
                }

                $batch->decrement('current_count', $i['count']);
                if ($batch->fresh()->current_count <= 0) {
                    $batch->update(['status' => 'depleted']);
                }

                StockMovement::create([
                    'batch_id'       => $batch->id,
                    'type'           => 'out',
                    'from_pond_id'   => $batch->pond_id,
                    'to_pond_id'     => null,
                    'count'          => -$i['count'],
                    'reference_type' => 'Sale',
                    'reference_id'   => $sale->id,
                    'movement_date'  => $sale->sale_date,
                    'created_by'     => $sale->created_by,
                ]);
            }

            return $sale->load('items');
        }));
    }
}
