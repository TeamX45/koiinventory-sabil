<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedUser(
            email: 'owner@dkkoi.com',
            name: 'Owner DK Koi',
            role: User::ROLE_OWNER,
            phone: '081200000001',
            envKey: 'SEED_OWNER_PASSWORD',
            devFallback: 'owner123',
        );

        $this->seedUser(
            email: 'admin@dkkoi.com',
            name: 'Admin DK Koi',
            role: User::ROLE_ADMIN,
            phone: '081200000002',
            envKey: 'SEED_ADMIN_PASSWORD',
            devFallback: 'admin123',
        );

        $this->seedUser(
            email: 'staff@dkkoi.com',
            name: 'Staff DK Koi',
            role: User::ROLE_STAFF,
            phone: '081200000003',
            envKey: 'SEED_STAFF_PASSWORD',
            devFallback: 'staff123',
        );
    }

    /**
     * Buat user kalau belum ada. Password HANYA diset saat pembuatan pertama —
     * re-seed tidak boleh menimpa password yang sudah diganti user sendiri.
     *
     * Di production, password wajib datang dari environment. Tanpa itu seeder
     * gagal keras, supaya server publik tidak pernah berdiri dengan password
     * default yang tertulis di repo.
     */
    private function seedUser(
        string $email,
        string $name,
        string $role,
        string $phone,
        string $envKey,
        string $devFallback,
    ): void {
        $exists = User::where('email', $email)->exists();

        $attributes = [
            'name'      => $name,
            'role'      => $role,
            'is_active' => true,
            'phone'     => $phone,
        ];

        if (! $exists) {
            $attributes['password'] = $this->resolvePassword($envKey, $devFallback);
        }

        User::updateOrCreate(['email' => $email], $attributes);
    }

    private function resolvePassword(string $envKey, string $devFallback): string
    {
        $password = env($envKey);

        if (filled($password)) {
            return $password;
        }

        if (app()->environment('production')) {
            throw new RuntimeException(
                "{$envKey} wajib diisi di environment production. "
                . 'Set password kuat di .env.prod sebelum menjalankan db:seed — '
                . 'seeder menolak memakai password default dari repo.'
            );
        }

        return $devFallback;
    }
}
