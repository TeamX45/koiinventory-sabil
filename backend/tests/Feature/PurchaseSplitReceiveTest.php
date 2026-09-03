<?php

namespace Tests\Feature;

use App\Models\Batch;
use App\Models\FishType;
use App\Models\Grade;
use App\Models\Location;
use App\Models\Pond;
use App\Models\PondCategory;
use App\Models\Purchase;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Terima pembelian dengan pemecahan ke beberapa kolam.
 *
 * Borongan jarang masuk ke satu kolam: dari 20 ekor bisa 5 ke kolam A, 10 ke B,
 * 5 ke C, masing-masing dengan jenis dan rentang ukuran sendiri. Sebelumnya
 * seluruh isi PO dilempar ke satu kolam staging, lalu harus dipindah manual
 * satu per satu.
 */
class PurchaseSplitReceiveTest extends TestCase
{
    use RefreshDatabase;

    private Purchase $purchase;

    /** @var array<string, Pond> */
    private array $ponds = [];

    private FishType $kohaku;

    private Grade $showQuality;

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

        foreach (['A', 'B', 'C'] as $name) {
            $this->ponds[$name] = Pond::create([
                'location_id' => $location->id, 'pond_category_id' => $category->id,
                'code' => "P-{$name}", 'name' => "Kolam {$name}", 'is_active' => true,
            ]);
        }

        $this->kohaku      = FishType::create(['code' => 'KOH', 'name' => 'Kohaku']);
        $this->showQuality = Grade::create(['code' => 'SQ', 'name' => 'Show Quality', 'rank' => 1]);

        $supplier = Supplier::create(['code' => 'SUP-1', 'name' => 'Pak Joko', 'is_active' => true]);

        $this->purchase = Purchase::create([
            'code'          => 'PO-202609-0001',
            'supplier_id'   => $supplier->id,
            'purchase_date' => now()->toDateString(),
            'total_count'   => 20,
            'subtotal'      => 2000000,
            'status'        => 'pending',
        ]);
    }

    private function receive(array $allocations)
    {
        return $this->postJson("/api/v1/purchases/{$this->purchase->id}/receive", [
            'allocations' => $allocations,
        ]);
    }

    public function test_twenty_fish_can_be_split_across_three_ponds(): void
    {
        $this->receive([
            ['pond_id' => $this->ponds['A']->id, 'count' => 5],
            ['pond_id' => $this->ponds['B']->id, 'count' => 10],
            ['pond_id' => $this->ponds['C']->id, 'count' => 5],
        ])->assertOk()->assertJsonPath('message', 'Barang diterima dan dibagi ke 3 kolam.');

        $this->assertSame(3, Batch::count());
        $this->assertSame(5, (int) Batch::where('pond_id', $this->ponds['A']->id)->sum('current_count'));
        $this->assertSame(10, (int) Batch::where('pond_id', $this->ponds['B']->id)->sum('current_count'));
        $this->assertSame(5, (int) Batch::where('pond_id', $this->ponds['C']->id)->sum('current_count'));
        $this->assertSame('received', $this->purchase->fresh()->status);

        // Tiap bagian tetap tertaut ke PO asalnya.
        $this->assertSame(3, Batch::where('source_type', 'purchase')->where('source_id', $this->purchase->id)->count());
    }

    public function test_each_part_keeps_its_own_fish_type_grade_and_size_range(): void
    {
        $this->receive([
            [
                'pond_id'      => $this->ponds['A']->id,
                'count'        => 12,
                'fish_type_id' => $this->kohaku->id,
                'grade_id'     => $this->showQuality->id,
                'size_cm'      => 10,
                'size_max_cm'  => 15,
            ],
            ['pond_id' => $this->ponds['B']->id, 'count' => 8, 'size_cm' => 20, 'size_max_cm' => 25],
        ])->assertOk();

        $a = Batch::where('pond_id', $this->ponds['A']->id)->sole();
        $this->assertSame($this->kohaku->id, $a->fish_type_id);
        $this->assertSame($this->showQuality->id, $a->grade_id);
        $this->assertSame(10, (int) $a->size_cm);
        $this->assertSame(15, (int) $a->size_max_cm);

        $b = Batch::where('pond_id', $this->ponds['B']->id)->sole();
        $this->assertNull($b->fish_type_id);
        $this->assertSame(20, (int) $b->size_cm);
        $this->assertSame(25, (int) $b->size_max_cm);
    }

    public function test_each_part_records_its_own_incoming_movement(): void
    {
        $this->receive([
            ['pond_id' => $this->ponds['A']->id, 'count' => 5],
            ['pond_id' => $this->ponds['B']->id, 'count' => 15],
        ])->assertOk();

        $this->assertSame(2, StockMovement::count());
        $this->assertSame(20, (int) StockMovement::where('type', 'in')->sum('count'));
        $this->assertSame(
            [5, 15],
            StockMovement::orderBy('id')->pluck('count')->map(fn ($c) => (int) $c)->all(),
        );
    }

    public function test_the_split_must_account_for_every_fish(): void
    {
        $this->receive([
            ['pond_id' => $this->ponds['A']->id, 'count' => 5],
            ['pond_id' => $this->ponds['B']->id, 'count' => 10],
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Baru 15 dari 20 ekor yang ditempatkan. Sisa 5 ekor belum punya kolam.');

        // Gagal berarti tidak ada satu pun batch yang terlanjur dibuat.
        $this->assertSame(0, Batch::count());
        $this->assertSame('pending', $this->purchase->fresh()->status);
    }

    public function test_allocating_more_than_the_purchase_is_rejected(): void
    {
        $this->receive([
            ['pond_id' => $this->ponds['A']->id, 'count' => 15],
            ['pond_id' => $this->ponds['B']->id, 'count' => 10],
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Total alokasi 25 ekor melebihi isi PO yang 20 ekor.');

        $this->assertSame(0, Batch::count());
    }

    public function test_size_range_must_not_be_inverted(): void
    {
        $this->receive([
            ['pond_id' => $this->ponds['A']->id, 'count' => 20, 'size_cm' => 30, 'size_max_cm' => 10],
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('allocations.0.size_max_cm');
    }

    public function test_the_old_single_pond_payload_still_works(): void
    {
        $this->postJson("/api/v1/purchases/{$this->purchase->id}/receive", [
            'pond_id' => $this->ponds['A']->id,
        ])->assertOk()->assertJsonPath('message', 'Barang diterima.');

        $batch = Batch::sole();
        $this->assertSame(20, (int) $batch->current_count);
        $this->assertSame($this->ponds['A']->id, $batch->pond_id);
    }

    public function test_receiving_twice_is_refused(): void
    {
        $this->receive([['pond_id' => $this->ponds['A']->id, 'count' => 20]])->assertOk();

        $this->receive([['pond_id' => $this->ponds['B']->id, 'count' => 20]])
            ->assertStatus(422);

        $this->assertSame(1, Batch::count());
    }

    public function test_fish_split_at_receive_are_immediately_visible_in_each_pond(): void
    {
        $this->receive([
            ['pond_id' => $this->ponds['A']->id, 'count' => 5, 'fish_type_id' => $this->kohaku->id],
            ['pond_id' => $this->ponds['B']->id, 'count' => 15],
        ])->assertOk();

        // Inti permintaannya: tanpa transfer manual, tiap kolam langsung berisi.
        $this->getJson("/api/v1/ponds/{$this->ponds['A']->id}/batches")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.current_count', 5);

        $this->getJson("/api/v1/ponds/{$this->ponds['B']->id}/batches")
            ->assertOk()
            ->assertJsonPath('data.0.current_count', 15);
    }
}
