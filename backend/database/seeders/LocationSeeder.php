<?php

namespace Database\Seeders;

use App\Models\Location;
use Illuminate\Database\Seeder;

class LocationSeeder extends Seeder
{
    public function run(): void
    {
        $locations = [
            ['code' => 'SKR',  'name' => 'Sukaraja',     'type' => 'filter', 'address' => 'Sukaraja'],
            ['code' => 'KRT',  'name' => 'Ds. Keramat',  'type' => 'tanah',  'address' => 'Desa Keramat'],
            ['code' => 'PNC',  'name' => 'Ds. Penican',  'type' => 'tanah',  'address' => 'Desa Penican'],
        ];

        foreach ($locations as $loc) {
            Location::updateOrCreate(['code' => $loc['code']], $loc);
        }
    }
}
