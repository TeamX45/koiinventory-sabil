<?php

namespace Database\Seeders;

use App\Models\Location;
use App\Models\Pond;
use App\Models\PondCategory;
use Illuminate\Database\Seeder;

class PondSeeder extends Seeder
{
    public function run(): void
    {
        $skr  = Location::where('code', 'SKR')->firstOrFail();
        $krt  = Location::where('code', 'KRT')->firstOrFail();
        $pnc  = Location::where('code', 'PNC')->firstOrFail();

        $cat = fn (string $code) => PondCategory::where('code', $code)->firstOrFail()->id;

        // ---- Sukaraja: 10 kolam filter + 7 aquarium ----
        $sukarajaPonds = [
            // Kolam 1: Indukan (50-80 cm)
            ['code' => 'SKR-K01', 'name' => 'Kolam 1 - Indukan',           'cat' => 'INDUKAN', 'min' => 50, 'max' => 80],

            // Kolam 2-4: Jumbo / Calon Indukan
            ['code' => 'SKR-K02', 'name' => 'Kolam 2 - Jumbo',             'cat' => 'JUMBO',   'min' => 50, 'max' => 80],
            ['code' => 'SKR-K03', 'name' => 'Kolam 3 - Jumbo',             'cat' => 'JUMBO',   'min' => 50, 'max' => 80],
            ['code' => 'SKR-K04', 'name' => 'Kolam 4 - Jumbo',             'cat' => 'JUMBO',   'min' => 50, 'max' => 80],

            // Kolam 5: Siap Kontes
            ['code' => 'SKR-K05', 'name' => 'Kolam 5 - Siap Kontes',       'cat' => 'KONTES',  'min' => 30, 'max' => 60],

            // Kolam 6-9: Small Size
            ['code' => 'SKR-K06', 'name' => 'Kolam 6 - Small',             'cat' => 'SMALL',   'min' => null, 'max' => null],
            ['code' => 'SKR-K07', 'name' => 'Kolam 7 - Small',             'cat' => 'SMALL',   'min' => null, 'max' => null],
            ['code' => 'SKR-K08', 'name' => 'Kolam 8 - Small',             'cat' => 'SMALL',   'min' => null, 'max' => null],
            ['code' => 'SKR-K09', 'name' => 'Kolam 9 - Small',             'cat' => 'SMALL',   'min' => null, 'max' => null],

            // Kolam 10: Pembesaran Penjinak (15 -> 35 cm, 3 bulan)
            ['code' => 'SKR-K10', 'name' => 'Kolam 10 - Pembesaran Penjinak', 'cat' => 'PEMBESARAN_PNJ', 'min' => 15, 'max' => 35, 'months' => 3],
        ];

        foreach ($sukarajaPonds as $p) {
            Pond::updateOrCreate(
                ['code' => $p['code']],
                [
                    'location_id' => $skr->id,
                    'pond_category_id' => $cat($p['cat']),
                    'name' => $p['name'],
                    'target_min_size_cm' => $p['min'] ?? null,
                    'target_max_size_cm' => $p['max'] ?? null,
                    'grow_duration_months' => $p['months'] ?? null,
                    'is_active' => true,
                ]
            );
        }

        // Aquarium 1-7: Penangkaran
        for ($i = 1; $i <= 7; $i++) {
            $code = sprintf('SKR-AQ%02d', $i);
            Pond::updateOrCreate(
                ['code' => $code],
                [
                    'location_id' => $skr->id,
                    'pond_category_id' => $cat('PENANGKARAN'),
                    'name' => "Aquarium {$i} - Penangkaran",
                    'is_active' => true,
                ]
            );
        }

        // ---- Ds. Keramat: 4 kolam tanah pembesaran ----
        for ($i = 1; $i <= 4; $i++) {
            $code = sprintf('KRT-K%02d', $i);
            Pond::updateOrCreate(
                ['code' => $code],
                [
                    'location_id' => $krt->id,
                    'pond_category_id' => $cat('PEMBESARAN_TNH'),
                    'name' => "Kolam Tanah Keramat {$i}",
                    'target_min_size_cm' => 20,
                    'target_max_size_cm' => 40,
                    'grow_duration_months' => 5,
                    'is_active' => true,
                ]
            );
        }

        // ---- Ds. Penican: 3 kolam tanah pembesaran ----
        for ($i = 1; $i <= 3; $i++) {
            $code = sprintf('PNC-K%02d', $i);
            Pond::updateOrCreate(
                ['code' => $code],
                [
                    'location_id' => $pnc->id,
                    'pond_category_id' => $cat('PEMBESARAN_TNH'),
                    'name' => "Kolam Tanah Penican {$i}",
                    'target_min_size_cm' => 20,
                    'target_max_size_cm' => 40,
                    'grow_duration_months' => 5,
                    'is_active' => true,
                ]
            );
        }
    }
}
