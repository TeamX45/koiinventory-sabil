<?php

namespace Tests\Feature;

use App\Models\Batch;
use App\Models\FishType;
use App\Models\Grade;
use App\Models\Location;
use App\Models\Pond;
use App\Models\PondCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Alur yang diminta: jenis ikan -> grade -> kolam.
 * Menguji bahwa jenis ikan (termasuk sub-jenis) yang dipilih saat menyortir
 * benar-benar sampai ke batch hasil, bukan hilang di tengah jalan.
 */
class SortingByFishTypeTest extends TestCase
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

    private function makePond(string $code): Pond
    {
        $location = Location::create(['code' => 'LOC' . $code, 'name' => 'Lokasi ' . $code, 'type' => 'filter']);
        $category = PondCategory::create(['code' => 'CAT' . $code, 'name' => 'Kategori ' . $code]);

        return Pond::create([
            'code' => $code,
            'name' => 'Kolam ' . $code,
            'location_id' => $location->id,
            'pond_category_id' => $category->id,
            'is_active' => true,
        ]);
    }

    public function test_sub_jenis_terbawa_dari_sortir_ke_batch_hasil(): void
    {
        $this->actAsOwner();

        $kohaku = FishType::create(['code' => 'KHK', 'name' => 'Kohaku', 'group' => 'koi']);
        $tancho = FishType::create([
            'code' => 'TCH', 'name' => 'Tancho', 'group' => 'koi', 'parent_id' => $kohaku->id,
        ]);
        $grade = Grade::create(['code' => 'GA', 'name' => 'Grade A', 'rank' => 1]);

        $sourcePond = $this->makePond('SRC');
        $targetPond = $this->makePond('TGT');

        $source = Batch::create([
            'code' => 'BTC-SRC-1',
            'source_type' => 'manual',
            'source_id' => null,
            'pond_id' => $sourcePond->id,
            'initial_count' => 100,
            'current_count' => 100,
            'entry_date' => '2026-09-01',
            'status' => 'active',
        ]);

        // Sortir: 40 ekor Kohaku Tancho, Grade A, ke kolam tujuan
        $created = $this->postJson('/api/v1/sortings', [
            'source_batch_id' => $source->id,
            'sorting_date' => '2026-09-01',
            'total_loss' => 0,
            'results' => [[
                'fish_type_id' => $tancho->id,
                'grade_id' => $grade->id,
                'target_pond_id' => $targetPond->id,
                'count' => 40,
                'price_per_fish' => 25000,
            ]],
        ]);
        $created->assertStatus(201);
        $sortingId = $created->json('data.id');

        $this->postJson("/api/v1/sortings/{$sortingId}/complete")->assertStatus(200);

        // Batch hasil harus membawa sub-jenis, grade, dan kolam yang dipilih
        $this->assertDatabaseHas('batches', [
            'source_type'  => 'sorting',
            'fish_type_id' => $tancho->id,
            'grade_id'     => $grade->id,
            'pond_id'      => $targetPond->id,
            'current_count' => 40,
        ]);
    }

    public function test_jenis_ikan_boleh_dikosongkan_saat_sortir(): void
    {
        $this->actAsOwner();

        $grade = Grade::create(['code' => 'GB', 'name' => 'Grade B', 'rank' => 2]);
        $sourcePond = $this->makePond('SRC2');
        $targetPond = $this->makePond('TGT2');

        $source = Batch::create([
            'code' => 'BTC-SRC-2',
            'source_type' => 'manual',
            'source_id' => null,
            'pond_id' => $sourcePond->id,
            'initial_count' => 50,
            'current_count' => 50,
            'entry_date' => '2026-09-01',
            'status' => 'active',
        ]);

        // Perilaku lama tetap sah: tanpa fish_type_id sama sekali.
        $this->postJson('/api/v1/sortings', [
            'source_batch_id' => $source->id,
            'sorting_date' => '2026-09-01',
            'results' => [[
                'grade_id' => $grade->id,
                'target_pond_id' => $targetPond->id,
                'count' => 10,
                'price_per_fish' => 1000,
            ]],
        ])->assertStatus(201);
    }
}
