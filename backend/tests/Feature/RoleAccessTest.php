<?php

namespace Tests\Feature;

use App\Models\Grade;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Mengunci matriks hak akses owner / admin / staff.
 *
 * Sebelum ini hanya rute `users` yang dijaga — staff bisa membuat DAN
 * menghapus master data. Test ini mencegah celah itu terbuka lagi.
 */
class RoleAccessTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role): User
    {
        return User::create([
            'name'      => ucfirst($role),
            'email'     => $role . '@test.local',
            'password'  => 'x',
            'role'      => $role,
            'is_active' => true,
        ]);
    }

    private function actAs(string $role): User
    {
        $user = $this->user($role);
        Sanctum::actingAs($user);
        return $user;
    }

    // ---------- Master data ----------

    public function test_staff_tidak_bisa_membuat_master_data(): void
    {
        $this->actAs('staff');

        $this->postJson('/api/v1/grades', ['name' => 'Baru', 'rank' => 9])
            ->assertStatus(403);
    }

    public function test_staff_tidak_bisa_menghapus_master_data(): void
    {
        $grade = Grade::create(['code' => 'EXD', 'name' => 'Existing', 'rank' => 5]);
        $this->actAs('staff');

        $this->deleteJson("/api/v1/grades/{$grade->id}")->assertStatus(403);

        $this->assertDatabaseHas('grades', ['id' => $grade->id]);
    }

    public function test_staff_tidak_bisa_mengubah_master_data(): void
    {
        $grade = Grade::create(['code' => 'EXU', 'name' => 'Existing', 'rank' => 5]);
        $this->actAs('staff');

        $this->putJson("/api/v1/grades/{$grade->id}", ['name' => 'Diubah', 'rank' => 5])
            ->assertStatus(403);
    }

    public function test_staff_tetap_bisa_membaca_master_data(): void
    {
        Grade::create(['code' => 'EXR', 'name' => 'Existing', 'rank' => 5]);
        $this->actAs('staff');

        $this->getJson('/api/v1/grades')->assertStatus(200);
    }

    public function test_admin_bisa_mengelola_master_data(): void
    {
        $this->actAs('admin');

        $this->postJson('/api/v1/grades', ['name' => 'Oleh Admin', 'rank' => 7])
            ->assertStatus(201);
    }

    public function test_owner_bisa_mengelola_master_data(): void
    {
        $this->actAs('owner');

        $this->postJson('/api/v1/grades', ['name' => 'Oleh Owner', 'rank' => 8])
            ->assertStatus(201);
    }

    // ---------- Kelola user ----------

    public function test_hanya_owner_yang_bisa_kelola_user(): void
    {
        $this->actAs('staff');
        $this->getJson('/api/v1/users')->assertStatus(403);

        $this->actAs('admin');
        $this->getJson('/api/v1/users')->assertStatus(403);

        $this->actAs('owner');
        $this->getJson('/api/v1/users')->assertStatus(200);
    }

    // ---------- Matriks gate ----------

    public function test_matriks_gate_sesuai_rancangan(): void
    {
        $owner = $this->user('owner');
        $admin = $this->user('admin');
        $staff = $this->user('staff');

        // manage-users: owner saja
        $this->assertTrue(Gate::forUser($owner)->allows('manage-users'));
        $this->assertFalse(Gate::forUser($admin)->allows('manage-users'));
        $this->assertFalse(Gate::forUser($staff)->allows('manage-users'));

        // manage-master: owner + admin
        $this->assertTrue(Gate::forUser($owner)->allows('manage-master'));
        $this->assertTrue(Gate::forUser($admin)->allows('manage-master'));
        $this->assertFalse(Gate::forUser($staff)->allows('manage-master'));

        // approve-transactions: owner + admin
        $this->assertTrue(Gate::forUser($owner)->allows('approve-transactions'));
        $this->assertTrue(Gate::forUser($admin)->allows('approve-transactions'));
        $this->assertFalse(Gate::forUser($staff)->allows('approve-transactions'));
    }
}
