<?php

namespace Database\Seeders;

use App\Models\ExpenseCategory;
use Illuminate\Database\Seeder;

class ExpenseCategorySeeder extends Seeder
{
    /**
     * Kategori pengeluaran default — bisa ditambah/dihapus user manual.
     * Idempotent via updateOrCreate by code.
     */
    public function run(): void
    {
        $categories = [
            ['code' => 'LISTRIK',   'name' => 'Listrik',                'icon' => 'zap'],
            ['code' => 'AIR',       'name' => 'Air / PDAM',             'icon' => 'droplet'],
            ['code' => 'WIFI',      'name' => 'Internet / WiFi',        'icon' => 'wifi'],
            ['code' => 'PAKAN',     'name' => 'Pakan Ikan',             'icon' => 'utensils'],
            ['code' => 'OBAT',      'name' => 'Obat & Vitamin',         'icon' => 'pill'],
            ['code' => 'GAJI',      'name' => 'Gaji Karyawan',          'icon' => 'banknote'],
            ['code' => 'TRANSPORT', 'name' => 'Transportasi',           'icon' => 'truck'],
            ['code' => 'KONSUMSI',  'name' => 'Konsumsi (kopi, rokok)', 'icon' => 'coffee'],
            ['code' => 'HOST_LIVE', 'name' => 'Host Live / Marketing',  'icon' => 'video'],
            ['code' => 'SEWA',      'name' => 'Sewa Lahan / Tempat',    'icon' => 'home'],
            ['code' => 'MAINTAIN',  'name' => 'Perawatan Kolam',        'icon' => 'wrench'],
            ['code' => 'LAINNYA',   'name' => 'Lain-lain',              'icon' => 'more-horizontal'],
        ];

        foreach ($categories as $c) {
            ExpenseCategory::updateOrCreate(['code' => $c['code']], array_merge($c, [
                'is_active' => true,
            ]));
        }
    }
}
