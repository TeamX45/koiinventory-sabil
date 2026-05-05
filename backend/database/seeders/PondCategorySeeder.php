<?php

namespace Database\Seeders;

use App\Models\PondCategory;
use Illuminate\Database\Seeder;

class PondCategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['code' => 'INDUKAN',         'name' => 'Indukan / Master',          'is_breeding' => false, 'is_grow_out' => false, 'description' => 'Ikan indukan utama untuk program penangkaran. Bisa dijual (opsional).'],
            ['code' => 'JUMBO',           'name' => 'Jumbo / Calon Indukan',     'is_breeding' => false, 'is_grow_out' => false, 'description' => 'Ikan ukuran besar siap jual & calon indukan. 50-80 cm. Rp 2-10 jt.'],
            ['code' => 'KONTES',          'name' => 'Siap Kontes',               'is_breeding' => false, 'is_grow_out' => false, 'description' => 'Ikan dipersiapkan untuk kompetisi/kontes koi. 30-60 cm.'],
            ['code' => 'SMALL',           'name' => 'Small Size',                'is_breeding' => false, 'is_grow_out' => true,  'description' => 'Ikan kecil, siap jual atau berpotensi naik ke Jumbo.'],
            ['code' => 'PEMBESARAN_PNJ',  'name' => 'Pembesaran Penjinak',       'is_breeding' => false, 'is_grow_out' => true,  'description' => 'Pembesaran ikan jenis penjinak (Karasi, Cagoi, Benigoi, dll). 15cm -> 35cm, ~3 bulan.'],
            ['code' => 'PENANGKARAN',     'name' => 'Penangkaran (Aquarium)',    'is_breeding' => true,  'is_grow_out' => false, 'description' => 'Aquarium untuk pemijahan/breeding.'],
            ['code' => 'PEMBESARAN_TNH',  'name' => 'Pembesaran Tanah',          'is_breeding' => false, 'is_grow_out' => true,  'description' => 'Kolam tanah pembesaran hasil sortir grade bagus. 20cm -> 35-40cm, ~5 bulan.'],
        ];

        foreach ($categories as $cat) {
            PondCategory::updateOrCreate(['code' => $cat['code']], $cat);
        }
    }
}
