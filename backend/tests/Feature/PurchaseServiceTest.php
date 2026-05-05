<?php

namespace Tests\Feature;

use App\Models\Batch;
use App\Models\Location;
use App\Models\Pond;
use App\Models\PondCategory;
use App\Models\Purchase;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Services\PurchaseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Tests\TestCase;

class PurchaseServiceTest extends TestCase
{
    use RefreshDatabase;

    private function setupContext(): array
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
        $supplier = Supplier::create([
            'code' => 'SUP-001',
            'name' => 'Pak Joko',
            'is_active' => true,
        ]);
        $purchase = Purchase::create([
            'code'           => 'PO-202605-0001',
            'supplier_id'    => $supplier->id,
            'purchase_date'  => now()->toDateString(),
            'total_count'    => 100,
            'subtotal'       => 5000000,
            'status'         => 'pending',
        ]);

        return compact('pond', 'supplier', 'purchase');
    }

    public function test_receive_buat_batch_dan_stock_movement(): void
    {
        ['pond' => $pond, 'purchase' => $purchase] = $this->setupContext();

        $batch = app(PurchaseService::class)->receive($purchase, $pond->id);

        $this->assertEquals('received', $purchase->fresh()->status);
        $this->assertEquals(100, $batch->current_count);
        $this->assertEquals($pond->id, $batch->pond_id);
        $this->assertEquals('purchase', $batch->source_type);
        $this->assertEquals($purchase->id, $batch->source_id);
        $this->assertNull($batch->grade_id);
        $this->assertNull($batch->price_per_fish);

        $movement = StockMovement::where('batch_id', $batch->id)->first();
        $this->assertNotNull($movement);
        $this->assertEquals('in', $movement->type);
        $this->assertEquals(100, $movement->count);
    }

    public function test_receive_purchase_yang_bukan_pending_gagal(): void
    {
        ['pond' => $pond, 'purchase' => $purchase] = $this->setupContext();
        $purchase->update(['status' => 'received']);

        $this->expectException(InvalidArgumentException::class);
        app(PurchaseService::class)->receive($purchase, $pond->id);
    }
}
