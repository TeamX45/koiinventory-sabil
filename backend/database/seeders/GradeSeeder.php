<?php

namespace Database\Seeders;

use App\Models\Grade;
use Illuminate\Database\Seeder;

class GradeSeeder extends Seeder
{
    public function run(): void
    {
        $grades = [
            ['code' => 'SHOW',    'name' => 'Show Quality', 'rank' => 1, 'description' => 'Kualitas terbaik, layak kontes & premium sale'],
            ['code' => 'GRADE_A', 'name' => 'Grade A',      'rank' => 2, 'description' => 'Kualitas bagus, siap jual'],
            ['code' => 'GRADE_B', 'name' => 'Grade B',      'rank' => 3, 'description' => 'Perlu pembesaran lebih lanjut, masuk kolam filter pembesaran'],
        ];

        foreach ($grades as $g) {
            Grade::updateOrCreate(['code' => $g['code']], $g);
        }
    }
}
