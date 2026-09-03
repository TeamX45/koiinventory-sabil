<?php

namespace Tests\Feature;

use App\Models\Grade;
use App\Models\Location;
use App\Models\Pond;
use App\Models\PondCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Change feed adalah dasar dari pembaruan tabel tanpa refresh halaman:
 * klien poll /api/v1/changes lalu hanya me-refresh entitas yang versinya naik.
 * Kalau versi tidak naik, perubahan user lain tidak akan pernah terlihat.
 */
class ChangeFeedTest extends TestCase
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

    /** @return array<string, int> */
    private function versions(): array
    {
        return $this->getJson('/api/v1/changes')->assertOk()->json('data');
    }

    public function test_change_feed_requires_authentication(): void
    {
        $this->getJson('/api/v1/changes')->assertStatus(401);
    }

    public function test_reports_a_version_for_every_known_entity(): void
    {
        $this->actAsOwner();

        $versions = $this->versions();

        foreach (['ponds', 'batches', 'sales', 'grades', 'fish-types', 'dashboard'] as $entity) {
            $this->assertArrayHasKey($entity, $versions);
        }
    }

    public function test_creating_a_record_bumps_only_its_own_entity(): void
    {
        $this->actAsOwner();
        Cache::flush(); // versi mulai dari 0 supaya perbandingannya deterministik

        $this->postJson('/api/v1/grades', ['name' => 'Premium', 'rank' => 1])
            ->assertStatus(201);

        $versions = $this->versions();

        $this->assertGreaterThan(0, $versions['grades']);
        $this->assertSame(0, $versions['suppliers'], 'Entitas yang tidak tersentuh tidak boleh ikut naik');
    }

    public function test_updating_and_deleting_also_bump_the_version(): void
    {
        $this->actAsOwner();
        $grade = Grade::create(['code' => 'A', 'name' => 'A', 'rank' => 1]);

        Cache::flush();
        $this->putJson("/api/v1/grades/{$grade->id}", ['name' => 'B', 'rank' => 1])->assertOk();
        $this->assertGreaterThan(0, $this->versions()['grades'], 'Update wajib menaikkan versi');

        Cache::flush();
        $this->deleteJson("/api/v1/grades/{$grade->id}")->assertStatus(204);
        $this->assertGreaterThan(0, $this->versions()['grades'], 'Delete wajib menaikkan versi');
    }

    public function test_stock_change_busts_the_server_side_dashboard_cache(): void
    {
        $this->actAsOwner();

        $location = Location::create(['code' => 'L1', 'name' => 'Lokasi', 'type' => 'tanah']);
        $category = PondCategory::create(['code' => 'C1', 'name' => 'Kategori']);

        // Grade tidak dipakai angka dashboard — cache harus tetap utuh.
        Cache::put('dashboard:summary', ['stale' => true], 60);
        Grade::create(['code' => 'A', 'name' => 'A', 'rank' => 1]);
        $this->assertTrue(Cache::has('dashboard:summary'));

        // Kolam baru mengubah sebaran stok — cache 60 detik itu wajib dibuang,
        // kalau tidak angkanya basi bahkan setelah user refresh halaman.
        Cache::put('dashboard:summary', ['stale' => true], 60);
        Pond::create([
            'location_id' => $location->id, 'pond_category_id' => $category->id,
            'code' => 'P-1', 'name' => 'P1', 'is_active' => true,
        ]);
        $this->assertFalse(Cache::has('dashboard:summary'));
        $this->assertGreaterThan(0, $this->versions()['dashboard']);
    }
}
