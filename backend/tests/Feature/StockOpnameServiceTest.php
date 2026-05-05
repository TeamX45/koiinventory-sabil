<?php

namespace Tests\Feature;

use App\Models\Batch;
use App\Models\Location;
use App\Models\Pond;
use App\Models\PondCategory;
use App\Models\Purchase;
use App\Models\StockMovement;
use App\Models\StockOpname;
use App\Models\Supplier;
use App\Services\StockOpnameService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StockOpnameServiceTest extends TestCase
{
    use RefreshDatabase;

    private function setupBatch(int $stock = 100): Batch
    {
        $location = Location::create(['code' => 'KRM', 'name' => 'Keramat', 'type' => 'tanah']);
        $cat = PondCategory::create(['code' => 'AQ', 'name' => 'Aquarium', 'is_breeding' => false, 'is_grow_out' => false]);
        $pond = Pond::create([
            'location_id' => $location->id,
            'pond_category_id' => $cat->id,
            'code' => 'AQ-01',
            'name' => 'Aquarium 1',
            'is_active' => true,
        ]);
        $supplier = Supplier::create(['code' => 'SUP-T', 'name' => 'Test', 'is_active' => true]);
        $purchase = Purchase::create([
            'code'           => 'PO-T-001',
            'supplier_id'    => $supplier->id,
            'purchase_date'  => now()->toDateString(),
            'total_count'    => $stock,
            'subtotal'       => 1000000,
            'status'         => 'received',
        ]);

        return Batch::create([
            'code'          => 'BTC-TEST-' . uniqid(),
            'source_type'   => 'purchase',
            'source_id'     => $purchase->id,
            'pond_id'       => $pond->id,
            'initial_count' => $stock,
            'current_count' => $stock,
            'entry_date'    => now()->toDateString(),
            'status'        => 'active',
        ]);
    }

    public function test_complete_opname_dengan_selisih_negatif_kurangi_stok_batch(): void
    {
        $batch = $this->setupBatch(100);

        $opname = StockOpname::create([
            'code'         => 'SO-202605-0001',
            'batch_id'     => $batch->id,
            'opname_date'  => now()->toDateString(),
            'system_count' => 100,
            'actual_count' => 92, // 8 ekor hilang
            'difference'   => -8,
            'status'       => 'draft',
        ]);

        app(StockOpnameService::class)->complete($opname);

        $this->assertEquals(92, $batch->fresh()->current_count);
        $this->assertEquals('completed', $opname->fresh()->status);

        $movement = StockMovement::where('reference_type', 'StockOpname')
            ->where('reference_id', $opname->id)
            ->first();
        $this->assertNotNull($movement);
        $this->assertEquals(-8, $movement->count);
        $this->assertEquals('adjustment', $movement->type);
    }

    public function test_complete_opname_dengan_selisih_positif_tambah_stok_batch(): void
    {
        $batch = $this->setupBatch(50);

        $opname = StockOpname::create([
            'code'         => 'SO-TEST-002',
            'batch_id'     => $batch->id,
            'opname_date'  => now()->toDateString(),
            'system_count' => 50,
            'actual_count' => 53, // ada 3 ekor lebih
            'difference'   => 3,
            'status'       => 'draft',
        ]);

        app(StockOpnameService::class)->complete($opname);

        $this->assertEquals(53, $batch->fresh()->current_count);
    }

    public function test_complete_opname_actual_zero_set_batch_depleted(): void
    {
        $batch = $this->setupBatch(20);

        $opname = StockOpname::create([
            'code'         => 'SO-TEST-003',
            'batch_id'     => $batch->id,
            'opname_date'  => now()->toDateString(),
            'system_count' => 20,
            'actual_count' => 0,
            'difference'   => -20,
            'status'       => 'draft',
        ]);

        app(StockOpnameService::class)->complete($opname);

        $batch->refresh();
        $this->assertEquals(0, $batch->current_count);
        $this->assertEquals('depleted', $batch->status);
    }

    public function test_opname_yang_sudah_completed_tolak_complete_lagi(): void
    {
        $batch = $this->setupBatch(100);

        $opname = StockOpname::create([
            'code'         => 'SO-TEST-004',
            'batch_id'     => $batch->id,
            'opname_date'  => now()->toDateString(),
            'system_count' => 100,
            'actual_count' => 100,
            'difference'   => 0,
            'status'       => 'completed',
        ]);

        $this->expectException(\RuntimeException::class);
        app(StockOpnameService::class)->complete($opname);
    }
}
