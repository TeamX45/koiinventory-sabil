<?php

namespace Tests\Feature;

use App\Models\Batch;
use App\Models\Location;
use App\Models\Pond;
use App\Models\PondCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BulkOpnameTest extends TestCase
{
    use RefreshDatabase;

    private function setup3Batches(): array
    {
        $loc = Location::create(['code' => 'L', 'name' => 'Loc', 'type' => 'tanah']);
        $cat = PondCategory::create(['code' => 'C', 'name' => 'Cat', 'is_breeding' => false, 'is_grow_out' => false]);
        $pond = Pond::create([
            'location_id' => $loc->id, 'pond_category_id' => $cat->id,
            'code' => 'P-1', 'name' => 'P1', 'is_active' => true,
        ]);
        $batches = [];
        foreach ([100, 50, 200] as $i => $count) {
            $batches[] = Batch::create([
                'code' => "B-$i", 'source_type' => 'manual', 'source_id' => null,
                'pond_id' => $pond->id, 'initial_count' => $count, 'current_count' => $count,
                'entry_date' => now(), 'status' => 'active',
            ]);
        }
        return $batches;
    }

    private function actAsOwner(): User
    {
        $u = User::create([
            'name' => 'Owner', 'email' => 'owner@test.local',
            'password' => 'x', 'role' => 'owner', 'is_active' => true,
        ]);
        Sanctum::actingAs($u);
        return $u;
    }

    public function test_bulk_opname_creates_multiple_drafts_atomically(): void
    {
        $this->actAsOwner();
        $batches = $this->setup3Batches();

        $res = $this->postJson('/api/v1/stock-opnames/bulk', [
            'opname_date' => '2026-05-06',
            'notes' => 'Opname rutin',
            'rows' => [
                ['batch_id' => $batches[0]->id, 'actual_count' => 95],
                ['batch_id' => $batches[1]->id, 'actual_count' => 50],
                ['batch_id' => $batches[2]->id, 'actual_count' => 210],
            ],
        ]);

        $res->assertStatus(201);
        $this->assertDatabaseCount('stock_opnames', 3);

        // Verify selisih dihitung benar per batch
        $this->assertDatabaseHas('stock_opnames', [
            'batch_id' => $batches[0]->id, 'actual_count' => 95, 'difference' => -5,
        ]);
        $this->assertDatabaseHas('stock_opnames', [
            'batch_id' => $batches[1]->id, 'actual_count' => 50, 'difference' => 0,
        ]);
        $this->assertDatabaseHas('stock_opnames', [
            'batch_id' => $batches[2]->id, 'actual_count' => 210, 'difference' => 10,
        ]);
    }

    public function test_bulk_opname_rolls_back_all_on_invalid_row(): void
    {
        $this->actAsOwner();
        $batches = $this->setup3Batches();

        $res = $this->postJson('/api/v1/stock-opnames/bulk', [
            'opname_date' => '2026-05-06',
            'rows' => [
                ['batch_id' => $batches[0]->id, 'actual_count' => 90],
                ['batch_id' => 99999, 'actual_count' => 10], // invalid FK
            ],
        ]);

        $res->assertStatus(422);
        // Atomic: tidak ada record yg tersimpan
        $this->assertDatabaseCount('stock_opnames', 0);
    }

    public function test_bulk_opname_requires_at_least_one_row(): void
    {
        $this->actAsOwner();
        $this->setup3Batches();

        $this->postJson('/api/v1/stock-opnames/bulk', [
            'opname_date' => '2026-05-06',
            'rows' => [],
        ])->assertStatus(422)
          ->assertJsonValidationErrors(['rows']);
    }
}
