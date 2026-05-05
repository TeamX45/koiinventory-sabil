<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'owner@dkkoi.com'],
            [
                'name'      => 'Owner DK Koi',
                'password'  => 'owner123',  // di-hash otomatis via cast
                'role'      => User::ROLE_OWNER,
                'is_active' => true,
                'phone'     => '081200000001',
            ]
        );

        User::updateOrCreate(
            ['email' => 'admin@dkkoi.com'],
            [
                'name'      => 'Admin DK Koi',
                'password'  => 'admin123',
                'role'      => User::ROLE_ADMIN,
                'is_active' => true,
                'phone'     => '081200000002',
            ]
        );

        User::updateOrCreate(
            ['email' => 'staff@dkkoi.com'],
            [
                'name'      => 'Staff DK Koi',
                'password'  => 'staff123',
                'role'      => User::ROLE_STAFF,
                'is_active' => true,
                'phone'     => '081200000003',
            ]
        );
    }
}
