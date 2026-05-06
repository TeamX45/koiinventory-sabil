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

class BatchCrudTest extends TestCase
{
    use RefreshDatabase;

    private function setupPond(): Pond
    {
        $loc = Location::create(['code' => 'L', 'name' => 'Loc', 'type' => 'tanah']);
        $cat = PondCategory::create(['code' => 'C', 'name' => 'Cat', 'is_breeding' => false, 'is_grow_out' => false]);
        return Pond::create([
            'location_id' => $loc->id, 'pond_category_id' => $cat->id,
            'code' => 'P-1', 'name' => 'P1', 'is_active' => true,
        ]);
    }

    private function actAsOwner(): User
    {
        $user = User::create([
            'name' => 'Owner', 'email' => 'owner@test.local',
            'password' => 'x', 'role' => 'owner', 'is_active' => true,
        ]);
        Sanctum::actingAs($user);
        return $user;
    }

    public function test_can_create_manual_batch_in_existing_pond(): void
    {
        $this->actAsOwner();
        $pond = $this->setupPond();

        $res = $this->postJson('/api/v1/batches', [
            'pond_id'        => $pond->id,
            'count'          => 25,
            'size_cm'        => 30,
            'price_per_fish' => 150000,
            'notes'          => 'Stok manual test',
        ]);

        $res->assertStatus(201)
            ->assertJsonPath('data.current_count', 25)
            ->assertJsonPath('data.size_cm', 30)
            ->assertJsonPath('data.source_type', 'manual');

        $this->assertDatabaseHas('batches', ['pond_id' => $pond->id, 'current_count' => 25]);
        $this->assertDatabaseHas('stock_movements', [
            'to_pond_id' => $pond->id, 'count' => 25, 'type' => 'in',
        ]);
    }

    public function test_create_batch_validates_size_range(): void
    {
        $this->actAsOwner();
        $pond = $this->setupPond();

        $this->postJson('/api/v1/batches', [
            'pond_id'     => $pond->id,
            'count'       => 10,
            'size_cm'     => 50,
            'size_max_cm' => 30, // max < min should fail
        ])->assertStatus(422)
          ->assertJsonValidationErrors(['size_max_cm']);
    }

    public function test_can_update_batch_metadata_but_not_count(): void
    {
        $this->actAsOwner();
        $pond = $this->setupPond();
        $batch = Batch::create([
            'code' => 'B-1', 'source_type' => 'manual', 'source_id' => null,
            'pond_id' => $pond->id, 'initial_count' => 10, 'current_count' => 10,
            'size_cm' => 20, 'entry_date' => now(), 'status' => 'active',
        ]);

        $this->putJson("/api/v1/batches/{$batch->id}", [
            'size_cm' => 35, 'price_per_fish' => 200000,
        ])->assertStatus(200)
          ->assertJsonPath('data.size_cm', 35);

        $batch->refresh();
        $this->assertEquals(10, $batch->current_count, 'count should not change via update');
    }

    public function test_cannot_delete_purchase_sourced_batch(): void
    {
        $this->actAsOwner();
        $pond = $this->setupPond();
        $batch = Batch::create([
            'code' => 'B-1', 'source_type' => 'purchase', 'source_id' => 1,
            'pond_id' => $pond->id, 'initial_count' => 10, 'current_count' => 10,
            'entry_date' => now(), 'status' => 'active',
        ]);

        $this->deleteJson("/api/v1/batches/{$batch->id}")
            ->assertStatus(422);
    }

    public function test_can_delete_manual_batch(): void
    {
        $this->actAsOwner();
        $pond = $this->setupPond();
        $batch = Batch::create([
            'code' => 'B-1', 'source_type' => 'manual', 'source_id' => null,
            'pond_id' => $pond->id, 'initial_count' => 10, 'current_count' => 10,
            'entry_date' => now(), 'status' => 'active',
        ]);

        $this->deleteJson("/api/v1/batches/{$batch->id}")
            ->assertStatus(204);

        $this->assertDatabaseMissing('batches', ['id' => $batch->id]);
    }
}
