<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Setelan bawaan per jenis/varian ikan.
 *
 * Bukan pengikat: tidak ada stok yang tercatat dari sini. Nilainya hanya
 * dipakai untuk mengisi otomatis form sortir (grade + kolam tujuan) dan
 * form tambah ikan di detail kolam (grade saja, kolamnya sudah tetap).
 *
 * nullOnDelete supaya menghapus grade/kolam tidak memblokir apa pun —
 * setelan bawaannya cukup dikosongkan.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('fish_types', function (Blueprint $table) {
            $table->foreignId('default_grade_id')
                ->nullable()
                ->after('image_path')
                ->constrained('grades')
                ->nullOnDelete()
                ->comment('Grade bawaan saat varian ini dipilih di form');

            $table->foreignId('default_pond_id')
                ->nullable()
                ->after('default_grade_id')
                ->constrained('ponds')
                ->nullOnDelete()
                ->comment('Kolam tujuan bawaan saat varian ini dipilih di form sortir');
        });
    }

    public function down(): void
    {
        Schema::table('fish_types', function (Blueprint $table) {
            $table->dropConstrainedForeignId('default_grade_id');
            $table->dropConstrainedForeignId('default_pond_id');
        });
    }
};
