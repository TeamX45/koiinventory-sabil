<?php

namespace Database\Seeders;

use App\Models\FishType;
use Illuminate\Database\Seeder;

class FishTypeSeeder extends Seeder
{
    /**
     * Seeder Jenis Ikan.
     * Idempotent: pakai updateOrCreate by code → aman dijalankan ulang
     * tanpa wipe data existing.
     *
     * Penambahan dari catatan opname tulisan tangan user (Mei 2026).
     */
    public function run(): void
    {
        $types = [
            // === Penjinak (ikan komoditas / non-koi murni) ===
            ['code' => 'KARASI',           'name' => 'Karasi',                'group' => 'penjinak'],
            ['code' => 'KARASI_LEMON',     'name' => 'Karasi Lemon',          'group' => 'penjinak'],
            ['code' => 'KARASI_MUJI',      'name' => 'Karasi Muji',           'group' => 'penjinak'],
            ['code' => 'RED_KARASI',       'name' => 'Red Karasi',            'group' => 'penjinak'],
            ['code' => 'RED_KARASI_LEMON', 'name' => 'Red Karasi Lemon',      'group' => 'penjinak'],
            ['code' => 'KARASHIGOI',       'name' => 'Karashigoi',            'group' => 'penjinak'],
            ['code' => 'CAGOI',            'name' => 'Cagoi',                 'group' => 'penjinak'],
            ['code' => 'CHAGOI',           'name' => 'Chagoi',                'group' => 'penjinak'],
            ['code' => 'BENIGOI',          'name' => 'Benigoi',               'group' => 'penjinak'],
            ['code' => 'OCHIBA',           'name' => 'Ochiba Shigure',        'group' => 'penjinak'],
            ['code' => 'KAMUREL',          'name' => 'Kamurel',               'group' => 'penjinak'],
            ['code' => 'KARAMEL',          'name' => 'Karamel',               'group' => 'penjinak'],
            ['code' => 'SHURAGOI',         'name' => 'Shuragoi',              'group' => 'penjinak'],

            // === Kohaku family ===
            ['code' => 'KOHAKU',           'name' => 'Kohaku',                'group' => 'koi'],
            ['code' => 'KOHAKU_AKF',       'name' => 'Kohaku AKF',            'group' => 'koi'],
            ['code' => 'TANCHO_KOHAKU',    'name' => 'Tancho Kohaku',         'group' => 'koi'],

            // === Sanke family ===
            ['code' => 'SANKE',            'name' => 'Sanke',                 'group' => 'koi'],
            ['code' => 'TANCHO_SANKE',     'name' => 'Tancho Sanke',          'group' => 'koi'],

            // === Showa family ===
            ['code' => 'SHOWA',            'name' => 'Showa Sanshoku',        'group' => 'koi'],
            ['code' => 'SHOWA_DOIT',       'name' => 'Doitsu Showa',          'group' => 'koi'],
            ['code' => 'SHOWA_KINDAI',     'name' => 'Kindai Showa',          'group' => 'koi'],
            ['code' => 'SHOWA_GINRIN',     'name' => 'Ginrin Showa',          'group' => 'koi'],
            ['code' => 'SHOWA_KAWAGOI',    'name' => 'Showa Kawagoi',         'group' => 'koi'],
            ['code' => 'TANCHO_SHOWA',     'name' => 'Tancho Showa',          'group' => 'koi'],
            ['code' => 'MAD_SHUBA',        'name' => 'Madoka Shuba',          'group' => 'koi'],

            // === Utsuri / Hi family ===
            ['code' => 'SHIRO',            'name' => 'Shiro Utsuri',          'group' => 'koi'],
            ['code' => 'HI_UTSURI',        'name' => 'Hi Utsuri',             'group' => 'koi'],
            ['code' => 'BEKKO',            'name' => 'Bekko',                 'group' => 'koi'],

            // === Asagi / Shusui ===
            ['code' => 'ASAGI',            'name' => 'Asagi',                 'group' => 'koi'],
            ['code' => 'SHUSUI',           'name' => 'Shusui',                'group' => 'koi'],
            ['code' => 'KUCHIBENI_SHUSUI', 'name' => 'Kuchibeni Shusui',      'group' => 'koi'],

            // === Goshiki / Goromo ===
            ['code' => 'GOSHIKI',          'name' => 'Goshiki',               'group' => 'koi'],
            ['code' => 'GOROMO',           'name' => 'Goromo',                'group' => 'koi'],
            ['code' => 'TANCHO_GOROMO',    'name' => 'Tancho Goromo',         'group' => 'koi'],

            // === Ogon / metalik ===
            ['code' => 'YAMABUKI',         'name' => 'Yamabuki Ogon',         'group' => 'koi'],
            ['code' => 'PLATINUM',         'name' => 'Platinum Ogon',         'group' => 'koi'],
            ['code' => 'KUJAKU',           'name' => 'Kujaku',                'group' => 'koi'],
            ['code' => 'HARIWAKE',         'name' => 'Hariwake',              'group' => 'koi'],

            // === Kikokuryu / Kumonryu / Doitsu black ===
            ['code' => 'KIKOKURYU',        'name' => 'Kikokuryu',             'group' => 'koi'],
            ['code' => 'BENI_KIKO',        'name' => 'Beni Kikokuryu',        'group' => 'koi'],
            ['code' => 'BENI_KIKO_DOIT',   'name' => 'Beni Kikokuryu Doitsu', 'group' => 'koi'],
            ['code' => 'KUMONRYU',         'name' => 'Kumonryu',              'group' => 'koi'],

            // === Butterfly / Slayer (sirip panjang) ===
            ['code' => 'SLAYER',           'name' => 'Slayer (Butterfly)',    'group' => 'koi'],
            ['code' => 'PLATINUM_SLAYER',  'name' => 'Platinum Slayer',       'group' => 'koi'],

            // === Lainnya ===
            ['code' => 'TANCHO',           'name' => 'Tancho (umum)',         'group' => 'koi'],
            ['code' => 'ZIRO',             'name' => 'Ziro',                  'group' => 'koi'],
        ];

        foreach ($types as $t) {
            FishType::updateOrCreate(['code' => $t['code']], $t);
        }
    }
}
