<?php

namespace Tests\Feature;

use App\Models\Batch;
use App\Models\Grade;
use App\Models\Location;
use App\Models\Pond;
use App\Models\PondCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * config/cache.php menetapkan serializable_classes = false: tidak ada kelas PHP
 * yang boleh di-unserialize dari cache (pengerasan terhadap gadget chain kalau
 * APP_KEY bocor). Konsekuensinya, apa pun yang disimpan ke cache harus array
 * biasa — sebuah Collection akan kembali sebagai __PHP_Incomplete_Class dan
 * bocor ke JSON sebagai {"__PHP_Incomplete_Class_Name": "..."}.
 *
 * Bug ini tidak terlihat pada panggilan pertama (nilai dikembalikan langsung
 * dari closure) dan baru muncul pada panggilan kedua dalam masa cache. Test ini
 * menyalakan serialisasi pada array store supaya perilakunya sama dengan file
 * store di produksi.
 */
class CachedPayloadSerializationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['cache.stores.array.serialize' => true]);
        Cache::purge('array'); // paksa store dibangun ulang dengan setelan di atas
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

    private function seedInventory(): void
    {
        $location = Location::create(['code' => 'L1', 'name' => 'Sukaraja', 'type' => 'filter']);
        $category = PondCategory::create(['code' => 'C1', 'name' => 'Pembesaran']);
        $grade    = Grade::create(['code' => 'A', 'name' => 'Show Quality', 'rank' => 1]);
        $pond     = Pond::create([
            'location_id' => $location->id, 'pond_category_id' => $category->id,
            'code' => 'P-1', 'name' => 'Kolam 1', 'capacity' => 100, 'is_active' => true,
        ]);

        Batch::create([
            'code' => 'B-1', 'source_type' => 'manual', 'source_id' => null,
            'pond_id' => $pond->id, 'grade_id' => $grade->id,
            'initial_count' => 120, 'current_count' => 120, 'price_per_fish' => 50000,
            'entry_date' => now(), 'status' => 'active',
        ]);
    }

    public function test_dashboard_summary_survives_a_round_trip_through_the_cache(): void
    {
        $this->actAsOwner();
        $this->seedInventory();

        $first = $this->getJson('/api/v1/dashboard/summary')->assertOk();
        $second = $this->getJson('/api/v1/dashboard/summary')->assertOk();

        $this->assertStringNotContainsString('__PHP_Incomplete_Class_Name', $second->getContent());
        $this->assertSame($first->json('data'), $second->json('data'), 'Jawaban dari cache harus identik dengan yang pertama');
        $this->assertSame(120, $second->json('data.total_active_stock'));
        $this->assertSame(120, $second->json('data.stock_by_location.Sukaraja'));
        $this->assertSame('Show Quality', array_key_first($second->json('data.stock_by_grade')));
    }

    public function test_ai_analysis_payload_survives_a_round_trip_through_the_cache(): void
    {
        $this->actAsOwner();
        $this->seedInventory();
        config(['services.gemini.key' => 'kunci-uji', 'services.gemini.model' => 'gemini-uji']);

        Http::fake([
            '*generativelanguage.googleapis.com*' => Http::response([
                'candidates' => [[
                    'content' => ['parts' => [['text' => json_encode([
                        'ringkasan'   => 'Ringkas.',
                        'temuan'      => [['judul' => 'A', 'penjelasan' => 'B', 'tingkat' => 'baik']],
                        'rekomendasi' => [['aksi' => 'C', 'alasan' => 'D']],
                    ])]]],
                ]],
            ]),
        ]);

        $first = $this->postJson('/api/v1/ai/analysis')->assertOk();
        $second = $this->postJson('/api/v1/ai/analysis')->assertOk();

        $this->assertStringNotContainsString('__PHP_Incomplete_Class_Name', $second->getContent());
        $second->assertJsonPath('meta.dari_cache', true)
            ->assertJsonPath('data.stok.per_lokasi.0.lokasi', 'Sukaraja')
            ->assertJsonPath('analisis.ringkasan', 'Ringkas.');
        $this->assertSame($first->json('data'), $second->json('data'));
    }
}
