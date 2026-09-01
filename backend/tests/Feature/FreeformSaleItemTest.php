<?php

namespace Tests\Feature;

use App\Models\Batch;
use App\Models\FishType;
use App\Models\Grade;
use App\Models\Location;
use App\Models\Pond;
use App\Models\PondCategory;
use App\Models\SalesChannel;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Penjualan item bebas: menjual tanpa terikat batch, jenis ikan dipilih
 * atau diketik manual. Item begini hanya dicatat sebagai baris penjualan —
 * stok inventori tidak boleh berubah.
 */
class FreeformSaleItemTest extends TestCase
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

    private function channel(): SalesChannel
    {
        return SalesChannel::create(['code' => 'OFF', 'name' => 'Offline']);
    }

    private function activeBatch(int $count = 100): Batch
    {
        $location = Location::create(['code' => 'L1', 'name' => 'Lokasi', 'type' => 'filter']);
        $category = PondCategory::create(['code' => 'C1', 'name' => 'Kategori']);
        $pond = Pond::create([
            'code' => 'P1', 'name' => 'Kolam 1',
            'location_id' => $location->id, 'pond_category_id' => $category->id,
            'is_active' => true,
        ]);
        $grade = Grade::create(['code' => 'GA', 'name' => 'Grade A', 'rank' => 1]);

        return Batch::create([
            'code' => 'BTC-1', 'source_type' => 'manual', 'source_id' => null,
            'pond_id' => $pond->id, 'grade_id' => $grade->id,
            'initial_count' => $count, 'current_count' => $count,
            'price_per_fish' => 10000,
            'entry_date' => '2026-09-01', 'status' => 'active',
        ]);
    }

    public function test_item_tanpa_batch_dicatat_tanpa_mengubah_stok(): void
    {
        $this->actAsOwner();
        $channel = $this->channel();
        $batch = $this->activeBatch(100);
        $kohaku = FishType::create(['code' => 'KHK', 'name' => 'Kohaku', 'group' => 'koi']);

        $res = $this->postJson('/api/v1/sales', [
            'sales_channel_id' => $channel->id,
            'sale_date' => '2026-09-02',
            'items' => [[
                'fish_type_id' => $kohaku->id,
                'count' => 5,
                'price_per_fish' => 50000,
            ]],
        ]);

        $res->assertStatus(201);
        $this->assertDatabaseHas('sale_items', [
            'batch_id' => null,
            'fish_type_id' => $kohaku->id,
            'count' => 5,
        ]);
        // Stok batch yang ada tidak boleh tersentuh
        $this->assertSame(100, $batch->fresh()->current_count);
    }

    public function test_item_tanpa_batch_boleh_pakai_nama_ketik_manual(): void
    {
        $this->actAsOwner();
        $channel = $this->channel();

        $this->postJson('/api/v1/sales', [
            'sales_channel_id' => $channel->id,
            'sale_date' => '2026-09-02',
            'items' => [[
                'fish_name' => 'Koi campuran pasar',
                'count' => 3,
                'price_per_fish' => 20000,
            ]],
        ])->assertStatus(201);

        $this->assertDatabaseHas('sale_items', [
            'batch_id' => null,
            'fish_name' => 'Koi campuran pasar',
        ]);
    }

    public function test_item_tanpa_batch_wajib_punya_jenis_atau_nama(): void
    {
        $this->actAsOwner();
        $channel = $this->channel();

        // Tanpa batch_id, tanpa fish_type_id, tanpa fish_name → harus ditolak
        $res = $this->postJson('/api/v1/sales', [
            'sales_channel_id' => $channel->id,
            'sale_date' => '2026-09-02',
            'items' => [[
                'count' => 2,
                'price_per_fish' => 10000,
            ]],
        ]);

        $this->assertNotSame(201, $res->status());
        $this->assertDatabaseCount('sale_items', 0);
    }

    public function test_penjualan_berbasis_batch_tetap_memotong_stok(): void
    {
        $this->actAsOwner();
        $channel = $this->channel();
        $batch = $this->activeBatch(100);

        $this->postJson('/api/v1/sales', [
            'sales_channel_id' => $channel->id,
            'sale_date' => '2026-09-02',
            'items' => [[
                'batch_id' => $batch->id,
                'count' => 10,
                'price_per_fish' => 15000,
            ]],
        ])->assertStatus(201);

        // Perilaku lama harus utuh: stok berkurang
        $this->assertSame(90, $batch->fresh()->current_count);
    }
}
