<?php

namespace Database\Seeders;

use App\Models\FishType;
use Illuminate\Database\Seeder;

class FishTypeSeeder extends Seeder
{
    public function run(): void
    {
        $types = [
            // Penjinak (Kolam 10 Sukaraja)
            ['code' => 'KARASI',     'name' => 'Karasi',     'group' => 'penjinak'],
            ['code' => 'CAGOI',      'name' => 'Cagoi',      'group' => 'penjinak'],
            ['code' => 'BENIGOI',    'name' => 'Benigoi',    'group' => 'penjinak'],
            ['code' => 'RED_KARASI', 'name' => 'Red Karasi', 'group' => 'penjinak'],
            ['code' => 'KAMUREL',    'name' => 'Kamurel',    'group' => 'penjinak'],

            // Koi varieties (umum)
            ['code' => 'KOHAKU',     'name' => 'Kohaku',     'group' => 'koi'],
            ['code' => 'SANKE',      'name' => 'Sanke',      'group' => 'koi'],
            ['code' => 'SHOWA',      'name' => 'Showa',      'group' => 'koi'],
            ['code' => 'TANCHO',     'name' => 'Tancho',     'group' => 'koi'],
            ['code' => 'SHIRO',      'name' => 'Shiro Utsuri','group' => 'koi'],
            ['code' => 'GOSHIKI',    'name' => 'Goshiki',    'group' => 'koi'],
            ['code' => 'ASAGI',      'name' => 'Asagi',      'group' => 'koi'],
        ];

        foreach ($types as $t) {
            FishType::updateOrCreate(['code' => $t['code']], $t);
        }
    }
}
