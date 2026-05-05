<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            UserSeeder::class,
            LocationSeeder::class,
            PondCategorySeeder::class,
            PondSeeder::class,
            FishTypeSeeder::class,
            GradeSeeder::class,
            SalesChannelSeeder::class,
        ]);
    }
}
