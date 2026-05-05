<?php

namespace Tests\Feature;

use App\Models\Purchase;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PaginationTest extends TestCase
{
    use RefreshDatabase;

    private function authedUser(): User
    {
        $user = User::create([
            'name'     => 'Admin Test',
            'email'    => 'admin@test.com',
            'password' => bcrypt('secret'),
            'role'     => 'admin',
            'is_active' => true,
        ]);
        Sanctum::actingAs($user);
        return $user;
    }

    public function test_purchases_index_paginated_default_25(): void
    {
        $this->authedUser();
        $supplier = Supplier::create(['code' => 'SUP-001', 'name' => 'Test', 'is_active' => true]);

        // Buat 30 PO
        foreach (range(1, 30) as $i) {
            Purchase::create([
                'code'           => sprintf('PO-TEST-%04d', $i),
                'supplier_id'    => $supplier->id,
                'purchase_date'  => now()->subDays($i)->toDateString(),
                'total_count'    => 10,
                'subtotal'       => 1000000,
                'status'         => 'pending',
            ]);
        }

        $response = $this->getJson('/api/v1/purchases');

        $response->assertOk()
            ->assertJsonStructure([
                'data',
                'meta' => ['current_page', 'per_page', 'total', 'last_page'],
            ])
            ->assertJsonPath('meta.total', 30)
            ->assertJsonPath('meta.per_page', 25)
            ->assertJsonPath('meta.current_page', 1)
            ->assertJsonPath('meta.last_page', 2);

        $this->assertCount(25, $response->json('data'));
    }

    public function test_purchases_paginated_per_page_dan_page_param(): void
    {
        $this->authedUser();
        $supplier = Supplier::create(['code' => 'SUP-001', 'name' => 'Test', 'is_active' => true]);

        foreach (range(1, 50) as $i) {
            Purchase::create([
                'code'           => sprintf('PO-TEST-%04d', $i),
                'supplier_id'    => $supplier->id,
                'purchase_date'  => now()->subDays($i)->toDateString(),
                'total_count'    => 10,
                'subtotal'       => 1000000,
                'status'         => 'pending',
            ]);
        }

        $response = $this->getJson('/api/v1/purchases?per_page=10&page=3');

        $response->assertOk()
            ->assertJsonPath('meta.per_page', 10)
            ->assertJsonPath('meta.current_page', 3)
            ->assertJsonPath('meta.last_page', 5);

        $this->assertCount(10, $response->json('data'));
    }

    public function test_per_page_dibatasi_max_100(): void
    {
        $this->authedUser();
        $supplier = Supplier::create(['code' => 'SUP-001', 'name' => 'Test', 'is_active' => true]);

        $response = $this->getJson('/api/v1/purchases?per_page=999');

        $response->assertOk()->assertJsonPath('meta.per_page', 100);
    }
}
