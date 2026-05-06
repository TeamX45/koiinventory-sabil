<?php

namespace Tests\Feature;

use App\Models\Batch;
use App\Models\Grade;
use App\Models\Location;
use App\Models\Pond;
use App\Models\PondCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class GradeCrudTest extends TestCase
{
    use RefreshDatabase;

    private function actAsOwner(): User
    {
        $user = User::create([
            'name' => 'Owner', 'email' => 'owner@test.local',
            'password' => 'x', 'role' => 'owner', 'is_active' => true,
        ]);
        Sanctum::actingAs($user);
        return $user;
    }

    public function test_owner_can_create_grade(): void
    {
        $this->actAsOwner();

        $res = $this->postJson('/api/v1/grades', [
            'name' => 'Premium',
            'rank' => 1,
            'description' => 'Top quality',
        ]);

        $res->assertStatus(201)
            ->assertJsonPath('data.name', 'Premium')
            ->assertJsonPath('data.rank', 1);

        $this->assertDatabaseHas('grades', ['name' => 'Premium', 'rank' => 1]);
    }

    public function test_grade_create_validates_required_fields(): void
    {
        $this->actAsOwner();

        $this->postJson('/api/v1/grades', ['rank' => 1])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name']);
    }

    public function test_can_update_grade(): void
    {
        $this->actAsOwner();
        $g = Grade::create(['code' => 'GRD-1', 'name' => 'A', 'rank' => 2]);

        $this->putJson("/api/v1/grades/{$g->id}", ['rank' => 5])
            ->assertStatus(200)
            ->assertJsonPath('data.rank', 5);
    }

    public function test_cannot_delete_grade_if_used_by_batch(): void
    {
        $this->actAsOwner();
        $g = Grade::create(['code' => 'GRD-1', 'name' => 'A', 'rank' => 1]);
        $loc = Location::create(['code' => 'L', 'name' => 'Loc', 'type' => 'tanah']);
        $cat = PondCategory::create(['code' => 'C', 'name' => 'Cat', 'is_breeding' => false, 'is_grow_out' => false]);
        $pond = Pond::create([
            'location_id' => $loc->id, 'pond_category_id' => $cat->id,
            'code' => 'P-1', 'name' => 'P1', 'is_active' => true,
        ]);
        Batch::create([
            'code' => 'B-1', 'source_type' => 'manual', 'source_id' => null,
            'pond_id' => $pond->id, 'grade_id' => $g->id,
            'initial_count' => 10, 'current_count' => 10,
            'entry_date' => now(), 'status' => 'active',
        ]);

        $this->deleteJson("/api/v1/grades/{$g->id}")
            ->assertStatus(422)
            ->assertJsonStructure(['message']);

        $this->assertDatabaseHas('grades', ['id' => $g->id]);
    }

    public function test_can_delete_unused_grade(): void
    {
        $this->actAsOwner();
        $g = Grade::create(['code' => 'GRD-X', 'name' => 'X', 'rank' => 99]);

        $this->deleteJson("/api/v1/grades/{$g->id}")->assertStatus(204);
        $this->assertDatabaseMissing('grades', ['id' => $g->id]);
    }
}
