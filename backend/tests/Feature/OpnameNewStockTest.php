<?php

namespace Tests\Feature;

use App\Models\Batch;
use App\Models\FishType;
use App\Models\Grade;
use App\Models\Location;
use App\Models\Pond;
use App\Models\PondCategory;
use App\Models\StockMovement;
use App\Models\StockOpname;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Stok opname sebagai pintu masuk stok, bukan cuma alat koreksi.
 *
 * Petugas yang menghitung di kolam sering menemukan ikan yang belum pernah
 * didata. Sebelumnya ia harus membuat barisnya dulu lewat Detail Kolam, baru
 * bisa opname. Sekarang temuan itu bisa langsung dicatat dari opname dan
 * batch-nya dibuat otomatis saat opname diselesaikan.
 */
class OpnameNewStockTest extends TestCase
{
    use RefreshDatabase;

    private Pond $pond;

    private FishType $fishType;

    private Grade $grade;

    protected function setUp(): void
    {
        parent::setUp();

        $user = User::create([
            'name' => 'Owner', 'email' => 'owner@test.local',
            'password' => 'x', 'role' => 'owner', 'is_active' => true,
        ]);
        Sanctum::actingAs($user);

        $location = Location::create(['code' => 'L1', 'name' => 'Sukaraja', 'type' => 'filter']);
        $category = PondCategory::create(['code' => 'C1', 'name' => 'Pembesaran']);

        $this->pond = Pond::create([
            'location_id' => $location->id, 'pond_category_id' => $category->id,
            'code' => 'P-1', 'name' => 'Kolam 1', 'capacity' => 500, 'is_active' => true,
        ]);
        $this->fishType = FishType::create(['code' => 'KOH', 'name' => 'Kohaku']);
        $this->grade    = Grade::create(['code' => 'A', 'name' => 'Show Quality', 'rank' => 1]);
    }

    private function newStockRow(int $count = 40): array
    {
        return [
            'pond_id'        => $this->pond->id,
            'fish_type_id'   => $this->fishType->id,
            'grade_id'       => $this->grade->id,
            'size_cm'        => 15,
            'price_per_fish' => 75000,
            'actual_count'   => $count,
        ];
    }

    public function test_fish_found_in_an_empty_pond_can_be_recorded_from_opname(): void
    {
        $this->assertSame(0, Batch::count(), 'Kolamnya memang belum berisi apa pun');

        $res = $this->postJson('/api/v1/stock-opnames/bulk', [
            'opname_date' => now()->toDateString(),
            'notes'       => 'Hitung fisik awal',
            'rows'        => [$this->newStockRow(40)],
        ])->assertStatus(201);

        $opnameId = $res->json('data.0.id');

        // Draf belum menyentuh stok: batch baru muncul saat opname diselesaikan.
        $this->assertSame(0, Batch::count());
        $this->assertNull(StockOpname::find($opnameId)->batch_id);

        $this->postJson("/api/v1/stock-opnames/{$opnameId}/complete")->assertOk();

        $batch = Batch::sole();
        $this->assertSame($this->pond->id, $batch->pond_id);
        $this->assertSame($this->fishType->id, $batch->fish_type_id);
        $this->assertSame($this->grade->id, $batch->grade_id);
        $this->assertSame(40, (int) $batch->current_count);
        $this->assertSame(40, (int) $batch->initial_count);
        $this->assertSame(15, (int) $batch->size_cm);
        $this->assertSame('active', $batch->status);
        $this->assertSame('opname', $batch->source_type);
    }

    public function test_the_new_fish_show_up_in_the_pond_listing(): void
    {
        $this->postJson('/api/v1/stock-opnames/bulk', [
            'opname_date' => now()->toDateString(),
            'rows'        => [$this->newStockRow(40)],
        ])->assertStatus(201);

        $this->postJson('/api/v1/stock-opnames/' . StockOpname::sole()->id . '/complete')->assertOk();

        // Inti permintaannya: tanpa membuka Detail Kolam sama sekali, ikannya
        // sudah terdaftar di kolam itu.
        $this->getJson("/api/v1/ponds/{$this->pond->id}/batches")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.current_count', 40)
            ->assertJsonPath('data.0.pond_id', $this->pond->id);
    }

    public function test_completing_new_stock_records_an_incoming_movement(): void
    {
        $this->postJson('/api/v1/stock-opnames/bulk', [
            'opname_date' => now()->toDateString(),
            'rows'        => [$this->newStockRow(40)],
        ])->assertStatus(201);

        $opname = StockOpname::sole();
        $this->postJson("/api/v1/stock-opnames/{$opname->id}/complete")->assertOk();

        $movement = StockMovement::sole();
        $this->assertSame('in', $movement->type);
        $this->assertSame(40, (int) $movement->count);
        $this->assertSame($this->pond->id, (int) $movement->to_pond_id);
        $this->assertSame('StockOpname', $movement->reference_type);
        $this->assertSame($opname->id, (int) $movement->reference_id);
    }

    public function test_a_draft_that_is_never_completed_leaves_no_empty_batch(): void
    {
        $this->postJson('/api/v1/stock-opnames/bulk', [
            'opname_date' => now()->toDateString(),
            'rows'        => [$this->newStockRow(40)],
        ])->assertStatus(201);

        $this->assertSame(0, Batch::count());
        $this->getJson("/api/v1/ponds/{$this->pond->id}/batches")->assertJsonCount(0, 'data');
    }

    public function test_correction_and_new_stock_can_be_submitted_together(): void
    {
        $existing = Batch::create([
            'code' => 'B-1', 'source_type' => 'manual', 'source_id' => null,
            'pond_id' => $this->pond->id, 'fish_type_id' => $this->fishType->id,
            'initial_count' => 10, 'current_count' => 10,
            'entry_date' => now(), 'status' => 'active',
        ]);

        $res = $this->postJson('/api/v1/stock-opnames/bulk', [
            'opname_date' => now()->toDateString(),
            'rows'        => [
                ['batch_id' => $existing->id, 'actual_count' => 8],
                $this->newStockRow(25),
            ],
        ])->assertStatus(201);

        $this->assertStringContainsString('1 di antaranya ikan baru', $res->json('message'));

        foreach (StockOpname::all() as $opname) {
            $this->postJson("/api/v1/stock-opnames/{$opname->id}/complete")->assertOk();
        }

        $this->assertSame(8, (int) $existing->fresh()->current_count);
        $this->assertSame(2, Batch::count());
        $this->assertSame(33, (int) Batch::where('pond_id', $this->pond->id)->sum('current_count'));
    }

    public function test_new_stock_row_needs_at_least_one_fish(): void
    {
        $this->postJson('/api/v1/stock-opnames/bulk', [
            'opname_date' => now()->toDateString(),
            'rows'        => [array_merge($this->newStockRow(), ['actual_count' => 0])],
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('rows.0.actual_count');
    }

    public function test_a_row_without_batch_or_pond_is_rejected(): void
    {
        $this->postJson('/api/v1/stock-opnames/bulk', [
            'opname_date' => now()->toDateString(),
            'rows'        => [['actual_count' => 5]],
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('rows.0.pond_id');
    }

    public function test_fish_type_and_grade_are_optional_for_a_quick_count(): void
    {
        $this->postJson('/api/v1/stock-opnames/bulk', [
            'opname_date' => now()->toDateString(),
            'rows'        => [['pond_id' => $this->pond->id, 'actual_count' => 12]],
        ])->assertStatus(201);

        $this->postJson('/api/v1/stock-opnames/' . StockOpname::sole()->id . '/complete')->assertOk();

        $batch = Batch::sole();
        $this->assertSame(12, (int) $batch->current_count);
        $this->assertNull($batch->fish_type_id);
    }

    public function test_deleting_the_opname_removes_the_stock_it_created(): void
    {
        $this->postJson('/api/v1/stock-opnames/bulk', [
            'opname_date' => now()->toDateString(),
            'rows'        => [$this->newStockRow(40)],
        ])->assertStatus(201);

        $opname = StockOpname::sole();
        $this->postJson("/api/v1/stock-opnames/{$opname->id}/complete")->assertOk();
        $this->assertSame(1, Batch::count());

        $this->deleteJson("/api/v1/stock-opnames/{$opname->id}")->assertStatus(204);

        // Batch-nya ikut hilang, bukan tertinggal sebagai baris 0 ekor.
        $this->assertSame(0, Batch::count());
        $this->assertSame(0, StockMovement::count());
    }

    public function test_stock_that_has_already_moved_is_kept_and_never_goes_negative(): void
    {
        $this->postJson('/api/v1/stock-opnames/bulk', [
            'opname_date' => now()->toDateString(),
            'rows'        => [$this->newStockRow(40)],
        ])->assertStatus(201);

        $opname = StockOpname::sole();
        $this->postJson("/api/v1/stock-opnames/{$opname->id}/complete")->assertOk();
        $batch = Batch::sole();

        // Lima ekor mati sesudah opname: batch-nya sudah punya jejak lain.
        $this->postJson('/api/v1/mortalities', [
            'batch_id'       => $batch->id,
            'mortality_date' => now()->toDateString(),
            'count'          => 5,
            'cause'          => 'Sakit',
        ])->assertStatus(201);
        $this->assertSame(35, (int) $batch->fresh()->current_count);

        $this->deleteJson("/api/v1/stock-opnames/{$opname->id}")->assertStatus(204);

        $batch->refresh();
        $this->assertSame(1, Batch::count(), 'Batch dipertahankan karena sudah punya riwayat');
        $this->assertSame(0, (int) $batch->current_count, 'Dijepit di 0, bukan minus 5');
        $this->assertSame('depleted', $batch->status);
    }
}
